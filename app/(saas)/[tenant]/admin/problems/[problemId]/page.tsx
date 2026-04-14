import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import DeleteProblemButton from "../DeleteProblemButton"

const typeLabels: Record<string, string> = {
  single_choice: "択一式",
  multiple_choice: "複数選択",
  text: "記述式",
}

export default async function AdminProblemDetailPage({
  params,
}: {
  params: { tenant: string; problemId: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>問題詳細</CardTitle>
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
          <CardTitle>問題詳細</CardTitle>
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
          <CardTitle>問題詳細</CardTitle>
          <CardDescription>管理者のみアクセスできます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: problem } = await supabase
    .from("problems")
    .select("id,title,prompt,type,answer_text,explanation,created_at,problem_group_id,position")
    .eq("organization_id", organization.id)
    .eq("id", params.problemId)
    .single()

  if (!problem) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>問題詳細</CardTitle>
          <CardDescription>問題が見つかりません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: group } = problem.problem_group_id
    ? await supabase
        .from("problem_groups")
        .select("id,title")
        .eq("organization_id", organization.id)
        .eq("id", problem.problem_group_id)
        .maybeSingle()
    : { data: null as { id: string; title: string } | null }

  const { data: options } = await supabase
    .from("problem_options")
    .select("id,label,position,is_correct")
    .eq("organization_id", organization.id)
    .eq("problem_id", problem.id)
    .order("position", { ascending: true })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>問題詳細</CardTitle>
          <CardDescription>{organization.name}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="secondary">
            <Link href={`/${params.tenant}/admin/problems`}>一覧へ戻る</Link>
          </Button>
          <DeleteProblemButton tenant={params.tenant} problemId={problem.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span className="min-w-0 truncate">{problem.title}</span>
            <Badge variant="secondary">{typeLabels[problem.type] ?? problem.type}</Badge>
          </CardTitle>
          {group ? (
            <CardDescription>
              大問: {group.title} / 小問順: {typeof problem.position === "number" ? problem.position + 1 : "-"}
            </CardDescription>
          ) : (
            <CardDescription>大問: なし</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700">問題文</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {problem.prompt ?? "（未入力）"}
            </p>
          </div>

          {problem.type === "text" ? (
            <div>
              <p className="text-sm font-medium text-slate-700">模範解答</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {problem.answer_text ?? "（未入力）"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-slate-700">選択肢</p>
              <div className="mt-2 space-y-2">
                {(options ?? []).map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {typeof opt.position === "number" ? `${opt.position + 1}. ` : ""}
                      {opt.label}
                    </span>
                    {opt.is_correct ? (
                      <Badge variant="secondary">正解</Badge>
                    ) : (
                      <span className="text-xs text-slate-400"> </span>
                    )}
                  </div>
                ))}
                {options && options.length === 0 ? (
                  <p className="text-sm text-slate-500">（選択肢なし）</p>
                ) : null}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-slate-700">解説</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {problem.explanation ?? "（未入力）"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

