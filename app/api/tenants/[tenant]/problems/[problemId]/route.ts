import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { problemSchema } from "@/lib/validators/problem"

export async function GET(
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

  const { data: problem } = await supabase
    .from("problems")
    .select("id,title,prompt,type,answer_text,explanation,tags")
    .eq("organization_id", organization.id)
    .eq("id", params.problemId)
    .single()

  if (!problem) {
    return NextResponse.json({ message: "問題が見つかりません。" }, { status: 404 })
  }

  const { data: options } = await supabase
    .from("problem_options")
    .select("id,label,position,is_correct")
    .eq("organization_id", organization.id)
    .eq("problem_id", problem.id)
    .order("position", { ascending: true })

  return NextResponse.json({
    problem,
    options: options ?? [],
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: { tenant: string; problemId: string } }
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

  const { data: existing } = await supabase
    .from("problems")
    .select("id,type")
    .eq("organization_id", organization.id)
    .eq("id", params.problemId)
    .single()

  if (!existing) {
    return NextResponse.json({ message: "問題が見つかりません。" }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from("problems")
    .update({
      title: parsed.data.title,
      prompt: parsed.data.prompt,
      type: parsed.data.type,
      tags: parsed.data.tags ?? [],
      answer_text: parsed.data.type === "text" ? (parsed.data.textAnswer ?? null) : null,
      explanation: parsed.data.explanation ?? null,
    })
    .eq("organization_id", organization.id)
    .eq("id", params.problemId)

  if (updateError) {
    return NextResponse.json(
      { message: "問題の更新に失敗しました。", detail: updateError.message },
      { status: 500 }
    )
  }

  // options: reset and re-create when non-text
  const { error: deleteOptionsError } = await supabase
    .from("problem_options")
    .delete()
    .eq("organization_id", organization.id)
    .eq("problem_id", params.problemId)

  if (deleteOptionsError) {
    return NextResponse.json(
      { message: "選択肢の更新に失敗しました。", detail: deleteOptionsError.message },
      { status: 500 }
    )
  }

  if (parsed.data.type !== "text") {
    const optionsPayload = parsed.data.options.map((option, index) => ({
      organization_id: organization.id,
      problem_id: params.problemId,
      label: option.label,
      position: index,
      is_correct: option.isCorrect,
    }))

    if (optionsPayload.length > 0) {
      const { error: insertOptionsError } = await supabase
        .from("problem_options")
        .insert(optionsPayload)

      if (insertOptionsError) {
        return NextResponse.json(
          { message: "選択肢の更新に失敗しました。", detail: insertOptionsError.message },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ success: true })
}

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

