import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { problemSchema } from "@/lib/validators/problem"

export async function POST(
  request: Request,
  { params }: { params: { tenant: string } }
) {
  const payload = await request.json()
  const parsed = problemSchema.safeParse(payload)

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

  const groupTitle =
    typeof parsed.data.groupTitle === "string" ? parsed.data.groupTitle.trim() : ""

  let problemGroupId: string | null =
    typeof parsed.data.groupId === "string" ? parsed.data.groupId : null

  if (!problemGroupId && groupTitle.length > 0) {
    const { data: existingGroup } = await supabase
      .from("problem_groups")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("title", groupTitle)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingGroup?.id) {
      problemGroupId = existingGroup.id
    } else {
      const { data: createdGroup, error: groupError } = await supabase
        .from("problem_groups")
        .insert({
          organization_id: organization.id,
          title: groupTitle,
          created_by: userData.user.id,
        })
        .select("id")
        .single()

      if (groupError || !createdGroup) {
        return NextResponse.json(
          {
            message: "大問の作成に失敗しました。",
            detail: groupError?.message ?? null,
            hint: "SupabaseのDBに problem_groups テーブルとRLSポリシーが反映されているか確認してください。",
          },
          { status: 500 }
        )
      }

      problemGroupId = createdGroup.id
    }
  }

  let position = 0
  if (problemGroupId) {
    const { data: lastProblem } = await supabase
      .from("problems")
      .select("position")
      .eq("organization_id", organization.id)
      .eq("problem_group_id", problemGroupId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle()
    position = typeof lastProblem?.position === "number" ? lastProblem.position + 1 : 0
  }

  const { data: createdProblem, error: problemError } = await supabase
    .from("problems")
    .insert({
      organization_id: organization.id,
      problem_group_id: problemGroupId,
      position,
      title: parsed.data.title,
      prompt: parsed.data.prompt,
      type: parsed.data.type,
      answer_text: parsed.data.textAnswer ?? null,
      explanation: parsed.data.explanation ?? null,
      created_by: userData.user.id,
    })
    .select("id")
    .single()

  if (problemError || !createdProblem) {
    return NextResponse.json(
      {
        message: "問題の作成に失敗しました。",
        detail: problemError?.message ?? null,
        hint: "SupabaseのDBに problems.problem_group_id / problems.position が反映されているか確認してください。",
      },
      { status: 500 }
    )
  }

  if (parsed.data.type !== "text") {
    const optionsPayload = parsed.data.options.map((option, index) => ({
      organization_id: organization.id,
      problem_id: createdProblem.id,
      label: option.label,
      position: index,
      is_correct: option.isCorrect,
    }))

    if (optionsPayload.length > 0) {
      const { error: optionsError } = await supabase
        .from("problem_options")
        .insert(optionsPayload)

      if (optionsError) {
        return NextResponse.json(
          { message: "選択肢の保存に失敗しました。" },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ id: createdProblem.id })
}

