import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import TagFilter from "../../problems/tag-filter"
import GroupReorderList from "../problems/GroupReorderList"

export default async function AdminGroupsPage({
  params,
  searchParams,
}: {
  params: { tenant: string }
  searchParams?: { groupTag?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>大問管理</CardTitle>
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
          <CardTitle>大問管理</CardTitle>
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
          <CardTitle>大問管理</CardTitle>
          <CardDescription>管理者のみアクセスできます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const selectedGroupTag =
    typeof searchParams?.groupTag === "string" && searchParams.groupTag.trim().length > 0
      ? searchParams.groupTag.trim()
      : ""

  let groupsQuery = supabase
    .from("problem_groups")
    .select("id,title,created_at,tags")
    .eq("organization_id", organization.id)

  if (selectedGroupTag) {
    groupsQuery = groupsQuery.contains("tags", [selectedGroupTag])
  }

  const { data: groups } = await groupsQuery
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>大問管理</CardTitle>
          <CardDescription>{organization.name} の大問（問題セット）を管理します。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-cream-700">小問の追加は各大問から行えます。</p>
          <Button asChild>
            <Link href={`/${params.tenant}/admin/groups/new`}>大問を作成</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>大問一覧</CardTitle>
          <CardDescription>大問の順番を変更できます。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Link
              className="text-xs font-medium text-primary-600 hover:underline"
              href={`/${params.tenant}/admin/groups/new`}
            >
              大問を作成
            </Link>
          </div>
          <TagFilter
            tenant={params.tenant}
            tags={allGroupTags}
            selectedTag={selectedGroupTag}
            queryKey="groupTag"
            label="タグで絞り込み"
            htmlId="adminGroupTagFilter"
          />
          {groups && groups.length > 0 ? (
            <GroupReorderList
              tenant={params.tenant}
              reorderDisabled={Boolean(selectedGroupTag)}
              showEditLink
              groups={groups.map((group) => ({
                id: group.id,
                title: group.title,
                created_at: group.created_at,
                problemCount: groupCountById.get(group.id) ?? 0,
                tags: Array.isArray((group as { tags?: string[] }).tags)
                  ? ((group as { tags?: string[] }).tags ?? [])
                  : [],
              }))}
            />
          ) : (
            <div className="rounded-md border border-dashed border-cream-300 p-6 text-sm text-cream-700">
              {selectedGroupTag
                ? "このタグの大問がありません。"
                : "まだ大問がありません。「大問を作成」から追加してください。"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

