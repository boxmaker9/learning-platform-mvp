import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const attemptSchema = z.object({
  type: z.enum(["single_choice", "multiple_choice", "text"]),
  answerText: z.string().optional(),
  selectedOptionId: z.string().uuid().optional(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: { tenant: string; problemId: string } }
) {
  const payload = await request.json()
  const parsed = attemptSchema.safeParse(payload)

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

  const { data: problem } = await supabase
    .from("problems")
    .select("id,type")
    .eq("organization_id", organization.id)
    .eq("id", params.problemId)
    .single()

  if (!problem) {
    return NextResponse.json({ message: "問題が見つかりません。" }, { status: 404 })
  }

  const { data: options } = await supabase
    .from("problem_options")
    .select("id,is_correct")
    .eq("organization_id", organization.id)
    .eq("problem_id", problem.id)

  const selectedOptionIds =
    parsed.data.type === "single_choice" && parsed.data.selectedOptionId
      ? [parsed.data.selectedOptionId]
      : parsed.data.selectedOptionIds ?? []

  let isCorrect: boolean | null = null
  if (problem.type !== "text" && options) {
    const correctIds = options.filter((o) => o.is_correct).map((o) => o.id).sort()
    const selectedSorted = [...selectedOptionIds].sort()
    isCorrect =
      correctIds.length === selectedSorted.length &&
      correctIds.every((id, index) => id === selectedSorted[index])
  }

  const { error: insertError } = await supabase
    .from("problem_attempts")
    .insert({
      organization_id: organization.id,
      problem_id: problem.id,
      user_id: userData.user.id,
      selected_option_ids: selectedOptionIds.length > 0 ? selectedOptionIds : null,
      answer_text: parsed.data.answerText ?? null,
      is_correct: isCorrect,
    })

  if (insertError) {
    return NextResponse.json(
      { message: "回答の送信に失敗しました。" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

