import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const tenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
})

export async function POST(request: Request) {
  const payload = await request.json()
  const parsed = tenantSchema.safeParse(payload)

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

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      created_by: userData.user.id,
    })
    .select("id, slug")
    .single()

  if (orgError || !org) {
    console.error("org insert error", orgError)
    return NextResponse.json(
      {
        message: orgError?.message ?? "テナント作成に失敗しました。",
        code: orgError?.code ?? null,
        details: orgError?.details ?? null,
        hint: orgError?.hint ?? null,
      },
      { status: 500 }
    )
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: userData.user.id,
      role: "admin",
    })

  if (memberError) {
    console.error("member insert error", memberError)
    return NextResponse.json(
      {
        message: memberError.message ?? "管理者登録に失敗しました。",
        code: memberError.code ?? null,
        details: memberError.details ?? null,
        hint: memberError.hint ?? null,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ slug: org.slug })
}

