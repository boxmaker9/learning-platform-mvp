import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import ProblemAttemptForm from "./ProblemAttemptForm"

const typeLabels: Record<string, string> = {
  single_choice: "択一式",
  multiple_choice: "複数選択",
  text: "記述式",
}

type ProblemOption = {
  id: string
  label: string
}

export default async function ProblemAttemptPage({
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
          <CardTitle>問題に挑戦</CardTitle>
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
          <CardTitle>問題に挑戦</CardTitle>
          <CardDescription>テナントが見つかりません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: problem } = await supabase
    .from("problems")
    .select("id,title,prompt,type,explanation")
    .eq("organization_id", organization.id)
    .eq("id", params.problemId)
    .single()

  if (!problem) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>問題に挑戦</CardTitle>
          <CardDescription>問題が見つかりません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: options } = await supabase
    .from("problem_options")
    .select("id,label,position")
    .eq("organization_id", organization.id)
    .eq("problem_id", problem.id)
    .order("position", { ascending: true })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>問題に挑戦</CardTitle>
          <CardDescription>{organization.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">タイトル</p>
              <p className="text-lg font-semibold">{problem.title}</p>
            </div>
            <Badge variant="secondary">
              {typeLabels[problem.type] ?? problem.type}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-slate-500">問題文</p>
            <p className="mt-1 text-sm text-slate-700">{problem.prompt}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>回答</CardTitle>
          <CardDescription>解答を送信してください。</CardDescription>
        </CardHeader>
        <CardContent>
          <ProblemAttemptForm
            tenant={params.tenant}
            problemId={problem.id}
            type={problem.type}
            options={(options ?? []) as ProblemOption[]}
            explanation={problem.explanation ?? null}
          />
          <div className="flex justify-end pt-4">
            <Link
              href={`/${params.tenant}/problems`}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              問題一覧に戻る
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

