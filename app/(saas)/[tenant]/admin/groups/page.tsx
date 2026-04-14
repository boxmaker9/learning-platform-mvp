import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function AdminGroupsPage({
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
          <CardTitle>大問管理</CardTitle>
          <CardDescription>{organization.name} の大問（問題セット）を管理します。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">小問の追加は各大問から行えます。</p>
          <Button asChild>
            <Link href={`/${params.tenant}/admin/groups/new`}>大問を作成</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>大問一覧</CardTitle>
          <CardDescription>大問を選んで小問を追加できます。</CardDescription>
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
                    <span className="shrink-0 text-xs text-slate-500">
                      全{groupCountById.get(group.id) ?? 0}問
                    </span>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button asChild variant="secondary" size="sm">
                      <Link
                        href={`/${params.tenant}/admin/groups/${group.id}/problems/new`}
                      >
                        小問を追加
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-6 text-sm text-slate-500">
              まだ大問がありません。「大問を作成」から追加してください。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

