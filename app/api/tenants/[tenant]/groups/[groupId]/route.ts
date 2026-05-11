import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const updateGroupSchema = z.object({
  title: z.string().min(1),
  tags: z.array(z.string().min(1)).max(10).default([]),
})

export async function GET(
  _request: Request,
  { params }: { params: { tenant: string; groupId: string } }
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

  const { data: group } = await supabase
    .from("problem_groups")
    .select("id,title,tags,created_at")
    .eq("organization_id", organization.id)
    .eq("id", params.groupId)
    .single()

  if (!group) {
    return NextResponse.json({ message: "大問が見つかりません。" }, { status: 404 })
  }

  return NextResponse.json({ group })
}

export async function PATCH(
  request: Request,
  { params }: { params: { tenant: string; groupId: string } }
) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: "リクエスト形式が不正です。" }, { status: 400 })
  }

  const parsed = updateGroupSchema.safeParse(payload)
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

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userData.user.id)
    .single()

  if (membershipError || !membership || membership.role !== "admin") {
    return NextResponse.json({ message: "権限がありません。" }, { status: 403 })
  }

  const title = parsed.data.title.trim()
  const tags = Array.from(
    new Set((parsed.data.tags ?? []).map((t) => t.trim()).filter(Boolean))
  )

  const { error } = await supabase
    .from("problem_groups")
    .update({ title, tags })
    .eq("organization_id", organization.id)
    .eq("id", params.groupId)

  if (error) {
    return NextResponse.json(
      { message: "大問の更新に失敗しました。", detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { tenant: string; groupId: string } }
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
    .from("problem_groups")
    .delete()
    .eq("organization_id", organization.id)
    .eq("id", params.groupId)

  if (error) {
    return NextResponse.json(
      { message: "大問の削除に失敗しました。", detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

