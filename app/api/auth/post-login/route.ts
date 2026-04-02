import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

type MembershipRow = {
  organization_id: string
  role: "admin" | "student"
}

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return NextResponse.json({ redirectTo: "/login" }, { status: 401 })
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userData.user.id)

  const rows = (memberships ?? []) as MembershipRow[]

  const orgIds = Array.from(
    new Set(rows.map((row) => row.organization_id).filter(Boolean))
  )

  if (orgIds.length > 0) {
    const { data: organizations } = await supabase
      .from("organizations")
      .select("id, slug")
      .in("id", orgIds)

    const slugById = new Map(
      (organizations ?? [])
        .filter((org) => typeof org.slug === "string" && org.slug.length > 0)
        .map((org) => [String(org.id), String(org.slug)])
    )

    const adminOrgId = rows.find((row) => row.role === "admin")?.organization_id
    const adminSlug = adminOrgId ? slugById.get(adminOrgId) : undefined
    if (adminSlug) {
      return NextResponse.json({
        redirectTo: `/${adminSlug}/admin/problems/new`,
      })
    }

    const firstSlug = rows.map((row) => slugById.get(row.organization_id)).find(Boolean)
    if (firstSlug) {
      return NextResponse.json({ redirectTo: `/${firstSlug}` })
    }
  }

  const { data: ownedOrg } = await supabase
    .from("organizations")
    .select("slug")
    .eq("created_by", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ownedOrg?.slug) {
    return NextResponse.json({
      redirectTo: `/${ownedOrg.slug}/admin/problems/new`,
    })
  }

  return NextResponse.json({ redirectTo: "/tenants/new" })
}

