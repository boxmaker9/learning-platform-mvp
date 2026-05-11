import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import DeleteProblemButton from "./DeleteProblemButton"
import DeleteGroupButton from "./DeleteGroupButton"
import TagFilter from "../../problems/tag-filter"

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
  searchParams,
}: {
  params: { tenant: string }
  searchParams?: { tag?: string; groupTag?: string }
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

  const selectedTag =
    typeof searchParams?.tag === "string" && searchParams.tag.trim().length > 0
      ? searchParams.tag.trim()
      : ""

  const selectedGroupTag =
    typeof searchParams?.groupTag === "string" && searchParams.groupTag.trim().length > 0
      ? searchParams.groupTag.trim()
      : ""

  let problemsQuery = supabase
    .from("problems")
    .select("id,title,type,created_at,tags")
    .eq("organization_id", organization.id)
    .is("problem_group_id", null)

  if (selectedTag) {
    problemsQuery = problemsQuery.contains("tags", [selectedTag])
  }

  const { data: problems } = await problemsQuery.order("created_at", { ascending: false })

  let groupsQuery = supabase
    .from("problem_groups")
    .select("id,title,created_at,tags")
    .eq("organization_id", organization.id)

  if (selectedGroupTag) {
    groupsQuery = groupsQuery.contains("tags", [selectedGroupTag])
  }

  const { data: groups } = await groupsQuery.order("created_at", { ascending: false })

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

  const allGroupTags = Array.from(
    new Set(
      (groups ?? [])
        .flatMap((g) => (Array.isArray((g as any).tags) ? ((g as any).tags as string[]) : []))
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "ja"))

  const allTags = Array.from(
    new Set(
      (problems ?? [])
        .flatMap((p) => (Array.isArray((p as any).tags) ? ((p as any).tags as string[]) : []))
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "ja"))

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
          <TagFilter
            tenant={params.tenant}
            tags={allGroupTags}
            selectedTag={selectedGroupTag}
            queryKey="groupTag"
            label="大問タグで絞り込み"
            htmlId="adminProblemsGroupTagFilter"
          />
          {groups && groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      className="min-w-0 truncate font-medium hover:underline"
                      href={`/${params.tenant}/admin/groups/${group.id}`}
                    >
                      {group.title}
                    </Link>
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
              {selectedGroupTag
                ? "このタグの大問がありません。"
                : "まだ大問がありません。右上の「大問を作成」から追加してください。"}
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
          <TagFilter tenant={params.tenant} tags={allTags} selectedTag={selectedTag} />
          {problems && problems.length > 0 ? (
            <div className="space-y-3">
              {problems.map((problem) => (
                <div
                  key={problem.id}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <p className="min-w-0 truncate font-medium">{problem.title}</p>
                      <Link
                        className="shrink-0 text-xs font-medium text-primary-600 hover:underline"
                        href={`/${params.tenant}/admin/problems/${problem.id}/edit`}
                      >
                        編集
                      </Link>
                    </div>
                    <Badge variant="secondary">
                      {typeLabels[problem.type] ?? problem.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>作成日: {formatDate(problem.created_at)}</span>
                    <DeleteProblemButton tenant={params.tenant} problemId={problem.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-6 text-sm text-slate-500">
              {selectedTag
                ? "このタグの小問がありません。"
                : "まだ小問がありません。右上の「小問を作成」から追加してください。"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

