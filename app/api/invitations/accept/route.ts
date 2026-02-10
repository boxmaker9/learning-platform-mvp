import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const acceptSchema = z.object({
  inviteId: z.string().uuid(),
})

export async function POST(request: Request) {
  const payload = await request.json()
  const parsed = acceptSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "入力内容を確認してください。", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = createSupabaseServerClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return NextResponse.json({ message: "認証が必要です。" }, { status: 401 })
  }

  const { data: invite, error: inviteError } = await supabase
    .from("organization_invitations")
    .select("id, organization_id, role, status")
    .eq("id", parsed.data.inviteId)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ message: "招待が見つかりません。" }, { status: 404 })
  }

  if (invite.status !== "pending") {
    return NextResponse.json({ message: "この招待は無効です。" }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from("organization_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: userData.user.id,
    })
    .eq("id", invite.id)

  if (updateError) {
    return NextResponse.json({ message: "招待の更新に失敗しました。" }, { status: 500 })
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: invite.organization_id,
      user_id: userData.user.id,
      role: invite.role,
    })

  if (memberError) {
    return NextResponse.json({ message: "メンバー登録に失敗しました。" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

