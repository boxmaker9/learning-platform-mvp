import Link from "next/link"

import AttemptHistoryView from "@/components/attempts/AttemptHistoryView"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listOrganizationUsers, userIdentifier } from "@/lib/admin/listOrganizationUsers"
import { loadAttemptHistory } from "@/lib/attempts/history"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function AdminAttemptsHistoryPage({
  params,
  searchParams,
}: {
  params: { tenant: string }
  searchParams?: { userId?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>解答履歴</CardTitle>
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
          <CardTitle>解答履歴</CardTitle>
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
          <CardTitle>解答履歴</CardTitle>
          <CardDescription>管理者のみアクセスできます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const users = await listOrganizationUsers(organization.id)
  const filterableUserIds = users.map((u) => u.user_id)
  const userByUserId = new Map(users.map((u) => [u.user_id, u]))

  const rawUserId =
    typeof searchParams?.userId === "string" && searchParams.userId.trim().length > 0
      ? searchParams.userId.trim()
      : ""

  const filterUserId =
    rawUserId && UUID_RE.test(rawUserId) && filterableUserIds.includes(rawUserId)
      ? rawUserId
      : ""

  const displayForUser = (uid: string) => {
    const user = userByUserId.get(uid)
    if (!user) return uid.slice(0, 8) + "…"
    const id = userIdentifier(user)
    const rolePrefix = user.role === "admin" ? "管理者 " : ""
    if (user.display_name?.trim()) return `${rolePrefix}${user.display_name}（${id}）`
    return `${rolePrefix}${id}`
  }

  const data = await loadAttemptHistory(supabase, organization.id, {
    filterUserId: filterUserId || undefined,
    displayForUser,
    hideUserLabels: Boolean(filterUserId),
    includeCategoryTop3: Boolean(filterUserId),
  })

  const filteredUserLabel = filterUserId ? displayForUser(filterUserId) : null

  return (
    <AttemptHistoryView
      tenant={params.tenant}
      organizationName={organization.name}
      introDescription={`${organization.name} の受講者の解答を確認できます。直近6ヶ月分のみ表示します（それ以前は定期的な削除の対象です）。`}
      statsScopeDescription="上の絞り込みを変えると、件数と正答率もその範囲に合わせて変わります。"
      categoryTop3Description={
        filterUserId
          ? `${filteredUserLabel} の表示中データ（直近6ヶ月・採点済みのみ）から、正答率が低いカテゴリを自動集計しています。小問タグがなければ大問タグを使います。`
          : undefined
      }
      data={data}
      allowDelete
      beforeHistoryList={
        <Card>
          <CardHeader>
            <CardTitle>ユーザーで絞り込み</CardTitle>
            <CardDescription>
              GET フォームで URL が変わります。ブックマークしやすい形です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1 space-y-1">
                <label htmlFor="userId" className="text-xs font-medium text-cream-800">
                  ユーザー
                </label>
                <select
                  id="userId"
                  name="userId"
                  defaultValue={filterUserId}
                  className="w-full rounded-md border border-cream-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">すべてのユーザー</option>
                  {users.map((user) => {
                    const id = userIdentifier(user)
                    const label = user.display_name?.trim()
                      ? `${user.display_name}（${id}）`
                      : id
                    const prefix = user.role === "admin" ? "[管理者] " : ""
                    return (
                      <option key={user.user_id} value={user.user_id}>
                        {prefix}
                        {label}
                      </option>
                    )
                  })}
                </select>
              </div>
              <Button type="submit">適用</Button>
              {filterUserId ? (
                <Button asChild variant="secondary" type="button">
                  <Link href={`/${params.tenant}/admin/attempts`}>解除</Link>
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
      }
    />
  )
}
