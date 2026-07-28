import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { applyOrderedPositions, requireTenantAdmin } from "@/lib/admin/reorder"

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export async function POST(
  request: Request,
  { params }: { params: { tenant: string } }
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

  const result = await applyOrderedPositions(
    admin.ctx.supabase,
    "problem_groups",
    admin.ctx.organizationId,
    parsed.data.orderedIds
  )

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, detail: "detail" in result ? result.detail : null },
      { status: 400 }
    )
  }

  const tenantPath = `/${params.tenant}`
  revalidatePath(`${tenantPath}/admin/problems`)
  revalidatePath(`${tenantPath}/admin/groups`)
  revalidatePath(`${tenantPath}/problems`)

  return NextResponse.json({ ok: true })
}
