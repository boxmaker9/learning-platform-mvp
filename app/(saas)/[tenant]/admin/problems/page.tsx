import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import DeleteProblemButton from "./DeleteProblemButton"
import DeleteGroupButton from "./DeleteGroupButton"

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

export default async function AdminProblemsPage({
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
          <CardTitle>問題一覧</CardTitle>
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
          <CardTitle>問題一覧</CardTitle>
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
          <CardTitle>問題一覧</CardTitle>
          <CardDescription>管理者のみアクセスできます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: problems } = await supabase
    .from("problems")
    .select("id,title,type,created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  const { data: groups } = await supabase
    .from("problem_groups")
    .select("id,title,created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  const groupIds = (groups ?? []).map((g) => g.id)
  const { data: groupedProblems } =
    groupIds.length > 0
      ? await supabase
          .from("problems")
          .select("problem_group_id")
          .eq("organization_id", organization.id)
          .in("problem_group_id", groupIds)
      : { data: [] as { problem_group_id: string | null }[] }

  const groupCountById = new Map<string, number>()
  ;(groupedProblems ?? []).forEach((row) => {
    if (!row.problem_group_id) return
    groupCountById.set(
      row.problem_group_id,
      (groupCountById.get(row.problem_group_id) ?? 0) + 1
    )
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>問題一覧</CardTitle>
          <CardDescription>{organization.name} の問題を管理します。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            問題の作成・編集は管理者のみ可能です。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="secondary">
              <Link href={`/${params.tenant}/admin/groups/new`}>大問を作成</Link>
            </Button>
            <Button asChild>
              <Link href={`/${params.tenant}/admin/problems/new`}>小問を作成</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>大問一覧</CardTitle>
          <CardDescription>大問（問題セット）を確認できます。</CardDescription>
        </CardHeader>
        <CardContent>
          {groups && groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="min-w-0 truncate font-medium">{group.title}</p>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 text-xs text-slate-500">
                        全{groupCountById.get(group.id) ?? 0}問
                      </span>
                      <DeleteGroupButton tenant={params.tenant} groupId={group.id} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>作成日: {formatDate(group.created_at)}</span>
                    <Link
                      className="font-medium text-primary-600 hover:underline"
                      href={`/${params.tenant}/admin/groups/${group.id}/problems/new`}
                    >
                      小問を追加
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-6 text-sm text-slate-500">
              まだ大問がありません。右上の「大問を作成」から追加してください。
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>小問一覧</CardTitle>
          <CardDescription>最新の小問から表示されます。</CardDescription>
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
                    <p className="font-medium">{problem.title}</p>
                    <Badge variant="secondary">
                      {typeLabels[problem.type] ?? problem.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>作成日: {formatDate(problem.created_at)}</span>
                    <DeleteProblemButton tenant={params.tenant} problemId={problem.id} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-6 text-sm text-slate-500">
              まだ小問がありません。右上の「小問を作成」から追加してください。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

