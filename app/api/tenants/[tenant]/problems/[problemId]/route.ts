import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function DELETE(
  _request: Request,
  { params }: { params: { tenant: string; problemId: string } }
) {
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

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userData.user.id)
    .single()

  if (membershipError || !membership || membership.role !== "admin") {
    return NextResponse.json({ message: "権限がありません。" }, { status: 403 })
  }

  const { error } = await supabase
    .from("problems")
    .delete()
    .eq("organization_id", organization.id)
    .eq("id", params.problemId)

  if (error) {
    return NextResponse.json(
      { message: "問題の削除に失敗しました。", detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

