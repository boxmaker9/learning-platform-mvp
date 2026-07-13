import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

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

  const { data: problem } = await supabase
    .from("problems")
    .select("id,title,prompt,type,answer_text,explanation,tags,problem_group_id")
    .eq("organization_id", organization.id)
    .eq("problem_group_id", params.groupId)
    .order("position", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!problem) {
    return NextResponse.json({ problem: null })
  }

  const { data: options } = await supabase
    .from("problem_options")
    .select("label,position,is_correct")
    .eq("organization_id", organization.id)
    .eq("problem_id", problem.id)
    .order("position", { ascending: true })

  return NextResponse.json({
    problem: {
      groupId: problem.problem_group_id ?? params.groupId,
      title: problem.title,
      prompt: problem.prompt ?? "",
      type: problem.type,
      tags: Array.isArray(problem.tags) ? problem.tags : [],
      options: (options ?? []).map((opt) => ({
        label: opt.label,
        isCorrect: Boolean(opt.is_correct),
      })),
      textAnswer: problem.answer_text ?? "",
      explanation: problem.explanation ?? "",
    },
  })
}
