import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase/server"

type TenantAdminContext = {
  supabase: SupabaseClient
  organizationId: string
}

export async function requireTenantAdmin(
  tenant: string
): Promise<{ ok: true; ctx: TenantAdminContext } | { ok: false; response: NextResponse }> {
  const supabase = createSupabaseServerClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return {
      ok: false,
      response: NextResponse.json({ message: "認証が必要です。" }, { status: 401 }),
    }
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", tenant)
    .single()

  if (!organization) {
    return {
      ok: false,
      response: NextResponse.json({ message: "テナントが見つかりません。" }, { status: 404 }),
    }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userData.user.id)
    .single()

  if (!membership || membership.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ message: "権限がありません。" }, { status: 403 }),
    }
  }

  return { ok: true, ctx: { supabase, organizationId: organization.id } }
}

export async function applyOrderedPositions(
  supabase: SupabaseClient,
  table: "problem_groups" | "problems",
  organizationId: string,
  orderedIds: string[],
  extraFilters?: { problem_group_id?: string }
) {
  let query = supabase.from(table).select("id").eq("organization_id", organizationId)

  if (extraFilters?.problem_group_id) {
    query = query.eq("problem_group_id", extraFilters.problem_group_id)
  }

  const { data: rows, error } = await query

  if (error) {
    return { ok: false as const, message: "並び替え対象の取得に失敗しました。" }
  }

  const validIds = new Set((rows ?? []).map((row) => row.id))
  const uniqueOrderedIds = new Set(orderedIds)

  if (
    orderedIds.length !== validIds.size ||
    uniqueOrderedIds.size !== orderedIds.length ||
    !orderedIds.every((id) => validIds.has(id))
  ) {
    return { ok: false as const, message: "並び替え対象が不正です。" }
  }

  const updates = orderedIds.map((id, position) => {
    let updateQuery = supabase
      .from(table)
      .update({ position })
      .eq("id", id)
      .eq("organization_id", organizationId)

    if (extraFilters?.problem_group_id) {
      updateQuery = updateQuery.eq("problem_group_id", extraFilters.problem_group_id)
    }

    return updateQuery
  })

  const results = await Promise.all(updates)
  const failed = results.find((result) => result.error)

  if (failed?.error) {
    return {
      ok: false as const,
      message: "並び替えの保存に失敗しました。",
      detail: failed.error.message,
    }
  }

  return { ok: true as const }
}

export async function nextGroupPosition(
  supabase: SupabaseClient,
  organizationId: string
): Promise<number> {
  const { data: lastGroup } = await supabase
    .from("problem_groups")
    .select("position")
    .eq("organization_id", organizationId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  return typeof lastGroup?.position === "number" ? lastGroup.position + 1 : 0
}
