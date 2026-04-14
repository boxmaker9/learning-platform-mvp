import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const createGroupSchema = z.object({
  title: z.string().min(1),
})

export async function GET(
  _request: Request,
  { params }: { params: { tenant: string } }
) {
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

  const { data: groups, error } = await supabase
    .from("problem_groups")
    .select("id,title,created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ message: "大問の取得に失敗しました。" }, { status: 500 })
  }

  return NextResponse.json({ groups: groups ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: { tenant: string } }
) {
  const payload = await request.json()
  const parsed = createGroupSchema.safeParse(payload)

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

  const title = parsed.data.title.trim()

  const { data: createdGroup, error } = await supabase
    .from("problem_groups")
    .insert({
      organization_id: organization.id,
      title,
      created_by: userData.user.id,
    })
    .select("id")
    .single()

  if (error || !createdGroup) {
    return NextResponse.json(
      { message: "大問の作成に失敗しました。", detail: error?.message ?? null },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: createdGroup.id })
}

