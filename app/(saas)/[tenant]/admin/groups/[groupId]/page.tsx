import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import DeleteGroupButton from "../../problems/DeleteGroupButton"

const typeLabels: Record<string, string> = {
  single_choice: "択一式",
  multiple_choice: "複数選択",
  text: "記述式",
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("ja-JP")
}

export default async function AdminGroupDetailPage({
  params,
}: {
  params: { tenant: string; groupId: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>大問詳細</CardTitle>
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
          <CardTitle>大問詳細</CardTitle>
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
          <CardTitle>大問詳細</CardTitle>
          <CardDescription>管理者のみアクセスできます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: group } = await supabase
    .from("problem_groups")
    .select("id,title,created_at")
    .eq("organization_id", organization.id)
    .eq("id", params.groupId)
    .single()

  if (!group) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>大問詳細</CardTitle>
          <CardDescription>大問が見つかりません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: problems } = await supabase
    .from("problems")
    .select("id,title,type,created_at,position")
    .eq("organization_id", organization.id)
    .eq("problem_group_id", group.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>大問詳細</CardTitle>
          <CardDescription>{organization.name}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="secondary">
            <Link href={`/${params.tenant}/admin/problems`}>問題一覧へ戻る</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary">
              <Link href={`/${params.tenant}/admin/groups/${group.id}/problems/new`}>
                小問を追加
              </Link>
            </Button>
            <DeleteGroupButton tenant={params.tenant} groupId={group.id} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span className="min-w-0 truncate">{group.title}</span>
            <span className="text-xs text-slate-500">作成日: {formatDate(group.created_at)}</span>
          </CardTitle>
          <CardDescription>この大問に含まれる小問一覧です。</CardDescription>
        </CardHeader>
        <CardContent>
          {problems && problems.length > 0 ? (
            <div className="space-y-3">
              {problems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/${params.tenant}/admin/problems/${problem.id}`}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-sm transition hover:border-primary-200"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="min-w-0 truncate font-medium">
                      {typeof problem.position === "number" ? `${problem.position + 1}. ` : ""}
                      {problem.title}
                    </p>
                    <Badge variant="secondary">
                      {typeLabels[problem.type] ?? problem.type}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    作成日: {formatDate(problem.created_at)}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-6 text-sm text-slate-500">
              まだ小問がありません。「小問を追加」から追加してください。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

