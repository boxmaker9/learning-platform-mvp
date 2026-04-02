import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const resetSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: Request) {
  const payload = await request.json()
  const parsed = resetSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "入力内容を確認してください。", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = createSupabaseServerClient()
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

