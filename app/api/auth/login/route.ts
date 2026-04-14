import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { authEmailFromLoginId, normalizeLoginId, normalizeTenantSlug, isValidLoginId } from "@/lib/auth/loginId"

const loginSchema = z.object({
  tenant: z.string().min(1),
  identifier: z.string().min(1),
  password: z.string().min(8),
})

export async function POST(request: Request) {
  const payload = await request.json()
  const parsed = loginSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "入力内容を確認してください。", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = createSupabaseServerClient()
  const tenant = normalizeTenantSlug(parsed.data.tenant)
  const identifier = String(parsed.data.identifier).trim()
  const password = parsed.data.password

  const email = identifier.includes("@")
    ? identifier
    : (() => {
        const loginId = normalizeLoginId(identifier)
        if (!isValidLoginId(loginId)) return ""
        return authEmailFromLoginId(tenant, loginId)
      })()

  if (!email) {
    return NextResponse.json({ message: "ログインIDまたはメールアドレスを確認してください。" }, { status: 400 })
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}

