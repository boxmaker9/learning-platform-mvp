import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import InviteForm from "./InviteForm"

export default async function AdminInvitationsPage({
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
          <CardTitle>招待</CardTitle>
          <CardDescription>ログインが必要です。</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm font-medium text-primary-600" href="/login">
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
          <CardTitle>招待</CardTitle>
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
          <CardTitle>招待</CardTitle>
          <CardDescription>管理者のみアクセスできます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: invitations } = await supabase
    .from("organization_invitations")
    .select("id,email,role,status,created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>メンバー招待</CardTitle>
          <CardDescription>
            {organization.name} に追加するメンバーを招待します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm tenant={params.tenant} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>送信済み招待</CardTitle>
          <CardDescription>作成済みの招待一覧です。</CardDescription>
        </CardHeader>
        <CardContent>
          {invitations && invitations.length > 0 ? (
            <div className="space-y-3">
              {invitations.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{invite.email}</p>
                    <Badge variant="secondary">{invite.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">Role: {invite.role}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">招待はまだありません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

