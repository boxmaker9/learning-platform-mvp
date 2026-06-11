import { NextResponse } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function requireAdmin(tenant: string) {
  const supabase = createSupabaseServerClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { error: NextResponse.json({ message: "認証が必要です。" }, { status: 401 }) }
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", tenant)
    .single()

  if (!organization) {
    return { error: NextResponse.json({ message: "テナントが見つかりません。" }, { status: 404 }) }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userData.user.id)
    .single()

  if (!membership || membership.role !== "admin") {
    return { error: NextResponse.json({ message: "権限がありません。" }, { status: 403 }) }
  }

  return { organization, userId: userData.user.id }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { tenant: string; userId: string } }
) {
  const auth = await requireAdmin(params.tenant)
  if ("error" in auth && auth.error) return auth.error

  const targetUserId = params.userId.trim()
  if (!UUID_RE.test(targetUserId)) {
    return NextResponse.json({ message: "ユーザーIDが不正です。" }, { status: 400 })
  }

  if (targetUserId === auth.userId) {
    return NextResponse.json({ message: "自分自身は削除できません。" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  const { data: targetMember } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", auth.organization.id)
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (!targetMember) {
    return NextResponse.json({ message: "ユーザーが見つかりません。" }, { status: 404 })
  }

  if (targetMember.role === "admin") {
    const { count, error: countError } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.organization.id)
      .eq("role", "admin")

    if (countError) {
      return NextResponse.json(
        { message: "管理者数の確認に失敗しました。", detail: countError.message },
        { status: 500 }
      )
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ message: "最後の管理者は削除できません。" }, { status: 400 })
    }
  }

  try {
    const admin = createSupabaseAdminClient()
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId)

    if (deleteError) {
      return NextResponse.json(
        { message: "ユーザーの削除に失敗しました。", detail: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "サーバーエラー"
    return NextResponse.json({ message: "ユーザーの削除に失敗しました。", detail: message }, { status: 500 })
  }
}
