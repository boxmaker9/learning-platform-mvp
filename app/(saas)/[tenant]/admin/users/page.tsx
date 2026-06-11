import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listOrganizationUsers, userIdentifier } from "@/lib/admin/listOrganizationUsers"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import UserDeleteButton from "./UserDeleteButton"
import UserPasswordField from "./UserPasswordField"

function formatJaDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  } catch {
    return iso
  }
}

function roleLabel(role: "admin" | "student") {
  return role === "admin" ? "管理者" : "受講者"
}

export default async function AdminUsersPage({
  params,
}: {
  params: { tenant: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
          <CardDescription>ログインが必要です。</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm font-medium text-primary-600 hover:underline" href="/login">
            ログインへ
          </Link>
        </CardContent>
      </Card>
    )
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", params.tenant)
    .single()

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
          <CardDescription>テナントが見つかりません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userData.user.id)
    .single()

  if (!membership || membership.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
          <CardDescription>管理者のみアクセスできます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const users = await listOrganizationUsers(organization.id)
  const adminCount = users.filter((u) => u.role === "admin").length
  const studentCount = users.filter((u) => u.role === "student").length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
          <CardDescription>
            {organization.name} の管理者・受講者アカウントです。ログインID（またはメール）と、作成時に保存した初期パスワードを確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            メールで登録した管理者はログインIDの代わりにメールアドレスを表示します。パスワードは目のアイコンで表示できます。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/${params.tenant}/admin/users/new`}>受講者を作成</Link>
            </Button>
            <Button asChild>
              <Link href={`/${params.tenant}/admin/users/new-admin`}>管理者を作成</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>アカウント</CardTitle>
          <CardDescription>
            全 {users.length} 件（管理者 {adminCount} / 受講者 {studentCount}）
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">まだユーザーがいません。</p>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-3">種別</th>
                  <th className="py-2 pr-3">ログインID / メール</th>
                  <th className="py-2 pr-3">表示名</th>
                  <th className="py-2 pr-3">パスワード</th>
                  <th className="py-2 pr-3">登録日</th>
                  <th className="py-2 text-right">削除</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.user_id === userData.user!.id
                  const deleteLabel = user.display_name?.trim()
                    ? `${user.display_name}（${userIdentifier(user)}）`
                    : userIdentifier(user)
                  return (
                    <tr key={user.user_id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3">
                        <span
                          className={
                            user.role === "admin"
                              ? "inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                              : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                          }
                        >
                          {roleLabel(user.role)}
                          {isSelf ? " · 自分" : ""}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-800">
                        {userIdentifier(user)}
                      </td>
                      <td className="py-2 pr-3 text-slate-800">
                        {user.display_name?.trim() ? user.display_name : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <UserPasswordField password={user.initial_password} />
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                        {formatJaDate(user.created_at)}
                      </td>
                      <td className="py-2 text-right">
                        <UserDeleteButton
                          tenant={params.tenant}
                          userId={user.user_id}
                          label={deleteLabel}
                          disabled={isSelf}
                          disabledReason="自分自身は削除できません"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
