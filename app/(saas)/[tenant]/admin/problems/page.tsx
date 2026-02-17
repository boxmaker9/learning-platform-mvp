import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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
          <Button asChild>
            <Link href={`/${params.tenant}/admin/problems/new`}>新規作成</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>登録済み問題</CardTitle>
          <CardDescription>最新の問題から表示されます。</CardDescription>
        </CardHeader>
        <CardContent>
          {problems && problems.length > 0 ? (
            <div className="space-y-3">
              {problems.map((problem) => (
                <div
                  key={problem.id}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{problem.title}</p>
                    <Badge variant="secondary">
                      {typeLabels[problem.type] ?? problem.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>作成日: {formatDate(problem.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-6 text-sm text-slate-500">
              まだ問題がありません。右上の「新規作成」から追加してください。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

