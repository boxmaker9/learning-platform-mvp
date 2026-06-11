import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const batchDeleteSchema = z.object({
  attemptIds: z.array(z.string().uuid()).min(1).max(500),
})

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

  return { organization }
}

export async function POST(
  request: Request,
  { params }: { params: { tenant: string } }
) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: "リクエスト形式が不正です。" }, { status: 400 })
  }

  const parsed = batchDeleteSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { message: "削除対象を確認してください。", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const auth = await requireAdmin(params.tenant)
  if ("error" in auth && auth.error) return auth.error

  const attemptIds = Array.from(new Set(parsed.data.attemptIds))
  const supabase = createSupabaseServerClient()

  const { data: existing, error: selectError } = await supabase
    .from("problem_attempts")
    .select("id")
    .eq("organization_id", auth.organization.id)
    .in("id", attemptIds)

  if (selectError) {
    return NextResponse.json(
      { message: "削除対象の確認に失敗しました。", detail: selectError.message },
      { status: 500 }
    )
  }

  if ((existing ?? []).length !== attemptIds.length) {
    return NextResponse.json(
      { message: "削除対象の一部が見つからないか、権限がありません。" },
      { status: 404 }
    )
  }

  const { error: deleteError } = await supabase
    .from("problem_attempts")
    .delete()
    .eq("organization_id", auth.organization.id)
    .in("id", attemptIds)

  if (deleteError) {
    return NextResponse.json(
      { message: "解答履歴の削除に失敗しました。", detail: deleteError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    deletedCount: attemptIds.length,
  })
}
