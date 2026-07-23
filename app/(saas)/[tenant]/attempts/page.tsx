import Link from "next/link"

import AttemptHistoryView from "@/components/attempts/AttemptHistoryView"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loadAttemptHistory } from "@/lib/attempts/history"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function StudentAttemptsHistoryPage({
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
          <CardTitle>解答履歴</CardTitle>
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
          <CardTitle>解答履歴</CardTitle>
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

  if (!membership) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>解答履歴</CardTitle>
          <CardDescription>このテナントのメンバーではありません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const data = await loadAttemptHistory(supabase, organization.id, {
    filterUserId: userData.user.id,
    hideUserLabels: true,
    includeCategoryTop3: true,
  })

  return (
    <AttemptHistoryView
      tenant={params.tenant}
      organizationName={organization.name}
      introDescription="あなたの解答履歴を確認できます。直近6ヶ月分のみ表示します（それ以前は定期的な削除の対象です）。"
      statsScopeDescription="あなたの解答のみを集計しています。"
      categoryTop3Description="あなたの表示中データ（直近6ヶ月・採点済みのみ）から、正答率が低いカテゴリを自動集計しています。小問タグがなければ大問タグを使います。"
      data={data}
      allowDelete={false}
    />
  )
}
