import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

type MembershipRow = {
  role: "admin" | "student"
  organization?: { slug: string | null }
}

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return NextResponse.json({ redirectTo: "/login" }, { status: 401 })
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(slug)")
    .eq("user_id", userData.user.id)

  const rows = (memberships ?? []) as MembershipRow[]
  const adminMembership = rows.find(
    (row) => row.role === "admin" && row.organization?.slug
  )

  if (adminMembership?.organization?.slug) {
    return NextResponse.json({
      redirectTo: `/${adminMembership.organization.slug}/admin/problems/new`,
    })
  }

  const firstMembership = rows.find((row) => row.organization?.slug)
  if (firstMembership?.organization?.slug) {
    return NextResponse.json({
      redirectTo: `/${firstMembership.organization.slug}`,
    })
  }

  return NextResponse.json({ redirectTo: "/tenants/new" })
}

