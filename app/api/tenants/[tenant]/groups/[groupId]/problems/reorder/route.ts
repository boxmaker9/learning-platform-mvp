import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { applyOrderedPositions, requireTenantAdmin } from "@/lib/admin/reorder"

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export async function POST(
  request: Request,
  { params }: { params: { tenant: string; groupId: string } }
) {
  const payload = await request.json()
  const parsed = reorderSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "入力内容を確認してください。", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const admin = await requireTenantAdmin(params.tenant)
  if (!admin.ok) {
    return admin.response
  }

  const { data: group } = await admin.ctx.supabase
    .from("problem_groups")
    .select("id")
    .eq("organization_id", admin.ctx.organizationId)
    .eq("id", params.groupId)
    .single()

  if (!group) {
    return NextResponse.json({ message: "大問が見つかりません。" }, { status: 404 })
  }

  const result = await applyOrderedPositions(
    admin.ctx.supabase,
    "problems",
    admin.ctx.organizationId,
    parsed.data.orderedIds,
    { problem_group_id: params.groupId }
  )

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, detail: "detail" in result ? result.detail : null },
      { status: 400 }
    )
  }

  const tenantPath = `/${params.tenant}`
  revalidatePath(`${tenantPath}/admin/groups/${params.groupId}`)
  revalidatePath(`${tenantPath}/groups/${params.groupId}`)
  revalidatePath(`${tenantPath}/admin/problems`)

  return NextResponse.json({ ok: true })
}
