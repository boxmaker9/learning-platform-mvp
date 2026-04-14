import { NextResponse } from "next/server"
import { z } from "zod"

import { normalizeLoginId, authEmailFromLoginId, isValidLoginId } from "@/lib/auth/loginId"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const createUserSchema = z.object({
  loginId: z.string().min(3).max(32),
  displayName: z.string().max(64).optional(),
  password: z.string().min(8),
})

export async function POST(
  request: Request,
  { params }: { params: { tenant: string } }
) {
  const payload = await request.json()
  const parsed = createUserSchema.safeParse(payload)

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

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", params.tenant)
    .single()

  if (!organization) {
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

  const loginId = normalizeLoginId(parsed.data.loginId)
  if (!isValidLoginId(loginId)) {
    return NextResponse.json(
      { message: "ログインIDは英数字と-_のみ、3〜32文字で入力してください。" },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()

  // uniqueness check per tenant
  const { data: existing } = await admin
    .from("user_profiles")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("login_id", loginId)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json({ message: "このログインIDは既に使われています。" }, { status: 409 })
  }

  const email = authEmailFromLoginId(params.tenant, loginId)

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
  })

  if (createError || !createdUser.user) {
    return NextResponse.json(
      { message: "ユーザー作成に失敗しました。", detail: createError?.message ?? null },
      { status: 500 }
    )
  }

  const newUserId = createdUser.user.id

  const { error: profileError } = await admin.from("user_profiles").insert({
    organization_id: organization.id,
    user_id: newUserId,
    login_id: loginId,
    display_name: parsed.data.displayName?.trim() || null,
  })

  if (profileError) {
    // rollback auth user if profile insert fails
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json(
      { message: "プロフィール作成に失敗しました。", detail: profileError.message },
      { status: 500 }
    )
  }

  const { error: memberError } = await admin.from("organization_members").insert({
    organization_id: organization.id,
    user_id: newUserId,
    role: "student",
  })

  if (memberError) {
    await admin.from("user_profiles").delete().eq("organization_id", organization.id).eq("user_id", newUserId)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json(
      { message: "所属の追加に失敗しました。", detail: memberError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    loginId,
    tenant: params.tenant,
  })
}

