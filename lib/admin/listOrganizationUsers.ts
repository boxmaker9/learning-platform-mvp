import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type OrganizationUserRow = {
  user_id: string
  role: "admin" | "student"
  login_id: string | null
  email: string | null
  display_name: string | null
  initial_password: string | null
  created_at: string
}

function roleSortOrder(role: OrganizationUserRow["role"]) {
  return role === "admin" ? 0 : 1
}

export function userIdentifier(user: OrganizationUserRow) {
  if (user.login_id) return user.login_id
  if (user.email) return user.email
  return `${user.user_id.slice(0, 8)}…`
}

export async function listOrganizationUsers(
  organizationId: string
): Promise<OrganizationUserRow[]> {
  const supabase = createSupabaseServerClient()

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", organizationId)

  if (!members || members.length === 0) {
    return []
  }

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, login_id, display_name, initial_password, created_at")
    .eq("organization_id", organizationId)

  const profileByUserId = new Map(
    (profiles ?? []).map((p) => [
      p.user_id,
      p as {
        user_id: string
        login_id: string
        display_name: string | null
        initial_password: string | null
        created_at: string
      },
    ])
  )

  let adminClient: ReturnType<typeof createSupabaseAdminClient> | null = null
  try {
    adminClient = createSupabaseAdminClient()
  } catch {
    adminClient = null
  }

  const rows: OrganizationUserRow[] = []

  for (const member of members) {
    const profile = profileByUserId.get(member.user_id)
    let email: string | null = null

    if (!profile && adminClient) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(member.user_id)
      email = authUser.user?.email ?? null
    }

    rows.push({
      user_id: member.user_id,
      role: member.role === "admin" ? "admin" : "student",
      login_id: profile?.login_id ?? null,
      email,
      display_name: profile?.display_name ?? null,
      initial_password: profile?.initial_password ?? null,
      created_at: profile?.created_at ?? member.created_at,
    })
  }

  rows.sort((a, b) => {
    const roleDiff = roleSortOrder(a.role) - roleSortOrder(b.role)
    if (roleDiff !== 0) return roleDiff
    return b.created_at.localeCompare(a.created_at)
  })

  return rows
}
