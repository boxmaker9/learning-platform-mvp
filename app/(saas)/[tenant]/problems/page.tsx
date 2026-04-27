import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import TagFilter from "./tag-filter"

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

export default async function StudentProblemsPage({
  params,
  searchParams,
}: {
  params: { tenant: string }
  searchParams?: { tag?: string }
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

  const selectedTag =
    typeof searchParams?.tag === "string" && searchParams.tag.trim().length > 0
      ? searchParams.tag.trim()
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
          <CardDescription>{organization.name} の問題に挑戦できます。</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>大問</CardTitle>
          <CardDescription>大問を選ぶと小問を連続で解けます。</CardDescription>
        </CardHeader>
        <CardContent>
          {groups && groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/${params.tenant}/groups/${group.id}`}
                  className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-white p-4 text-sm transition hover:border-primary-200"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{group.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      全{groupCountById.get(group.id) ?? 0}問
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">解く</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-6 text-sm text-slate-500">
              大問がまだありません。
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>受講者向け問題</CardTitle>
          <CardDescription>解きたい問題を選んでください。</CardDescription>
        </CardHeader>
        <CardContent>
          <TagFilter tenant={params.tenant} tags={allTags} selectedTag={selectedTag} />
          {problems && problems.length > 0 ? (
            <div className="space-y-3">
              {problems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/${params.tenant}/problems/${problem.id}`}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-sm transition hover:border-primary-200"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{problem.title}</p>
                    <Badge variant="secondary">
                      {typeLabels[problem.type] ?? problem.type}
                    </Badge>
                  </div>
                  {"tags" in problem && Array.isArray((problem as any).tags) && (problem as any).tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {((problem as any).tags as string[]).slice(0, 6).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>作成日: {formatDate(problem.created_at)}</span>
                    <span>解く</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-6 text-sm text-slate-500">
              {selectedTag ? "このタグの問題がありません。" : "まだ問題がありません。"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

