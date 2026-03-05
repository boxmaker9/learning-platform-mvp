import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const invitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "student"]).default("student"),
})

export async function POST(
  request: Request,
  { params }: { params: { tenant: string } }
) {
  const payload = await request.json()
  const parsed = invitationSchema.safeParse(payload)

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

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", params.tenant)
    .single()

  if (orgError || !organization) {
    return NextResponse.json({ message: "テナントが見つかりません。" }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userData.user.id)
    .single()

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ message: "権限がありません。" }, { status: 403 })
  }

  const { data: invite, error: inviteError } = await supabase
    .from("organization_invitations")
    .insert({
      organization_id: organization.id,
      email: parsed.data.email,
      role: parsed.data.role,
      created_by: userData.user.id,
    })
    .select("id")
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ message: "招待の作成に失敗しました。" }, { status: 500 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.INVITE_FROM_EMAIL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (resendApiKey && fromEmail && baseUrl) {
    const { Resend } = await import("resend")
    const resend = new Resend(resendApiKey)
    const inviteUrl = `${baseUrl}/tenants/invitations`

    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: parsed.data.email,
      subject: "招待が届きました",
      html: `
        <p>学習プラットフォームの招待が届きました。</p>
        <p>以下のURLからログインして招待を受諾してください。</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      `,
    })

    if (emailError) {
      return NextResponse.json(
        { message: "招待メール送信に失敗しました。" },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ id: invite.id })
}

