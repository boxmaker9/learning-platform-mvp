import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import GroupAttemptRunner, { type GroupProblem } from "./GroupAttemptRunner"

type OptionRow = {
  id: string
  label: string
  position: number | null
  problem_id: string
}

export default async function GroupAttemptPage({
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
          <CardTitle>大問に挑戦</CardTitle>
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
          <CardTitle>大問に挑戦</CardTitle>
          <CardDescription>テナントが見つかりません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: group } = await supabase
    .from("problem_groups")
    .select("id,title")
    .eq("organization_id", organization.id)
    .eq("id", params.groupId)
    .single()

  if (!group) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>大問に挑戦</CardTitle>
          <CardDescription>大問が見つかりません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: problems } = await supabase
    .from("problems")
    .select("id,title,prompt,type,position")
    .eq("organization_id", organization.id)
    .eq("problem_group_id", group.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

  const problemIds = (problems ?? []).map((p) => p.id)
  const { data: options } =
    problemIds.length > 0
      ? await supabase
          .from("problem_options")
          .select("id,label,position,problem_id")
          .eq("organization_id", organization.id)
          .in("problem_id", problemIds)
          .order("position", { ascending: true })
      : { data: [] as OptionRow[] }

  const optionsByProblem = new Map<string, OptionRow[]>()
  ;(options ?? []).forEach((row) => {
    const list = optionsByProblem.get(row.problem_id) ?? []
    list.push(row)
    optionsByProblem.set(row.problem_id, list)
  })

  const packed: GroupProblem[] = (problems ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    prompt: p.prompt ?? null,
    type: p.type,
    options: (optionsByProblem.get(p.id) ?? []).map((o) => ({
      id: o.id,
      label: o.label,
    })),
  }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>大問に挑戦</CardTitle>
          <CardDescription>
            {organization.name} / {params.tenant}
          </CardDescription>
        </CardHeader>
      </Card>

      <GroupAttemptRunner tenant={params.tenant} groupTitle={group.title} problems={packed} />
    </div>
  )
}

