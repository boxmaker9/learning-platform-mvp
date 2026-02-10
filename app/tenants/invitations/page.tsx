import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import AcceptInviteButton from "./AcceptInviteButton"

export default async function InvitationsPage() {
  const supabase = createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>招待一覧</CardTitle>
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

  const { data: invites } = await supabase
    .from("organization_invitations")
    .select("id, organization_id, email, role, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>招待一覧</CardTitle>
          <CardDescription>受信した招待を確認できます。</CardDescription>
        </CardHeader>
        <CardContent>
          {invites && invites.length > 0 ? (
            <div className="space-y-4">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{invite.email}</p>
                    <Badge variant="secondary">{invite.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">Role: {invite.role}</p>
                  <AcceptInviteButton inviteId={invite.id} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">未処理の招待はありません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

