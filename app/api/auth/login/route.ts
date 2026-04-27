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
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: "リクエスト形式が不正です。" }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "入力内容を確認してください。", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

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

  try {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Supabaseへの接続に失敗しました。"
    return NextResponse.json(
      {
        message: "ログインに失敗しました（サーバー側の通信エラー）。",
        detail: message,
        hint:
          "Vercelの環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が正しいか確認してください。",
      },
      { status: 503 }
    )
  }
}

