"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session))
    })
  }, [])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess("パスワードを更新しました。ログインしてください。")
      event.currentTarget.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラーが発生しました。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新しいパスワード</CardTitle>
        <CardDescription>再設定メールから開いた場合のみ更新できます。</CardDescription>
      </CardHeader>
      <CardContent>
        {hasSession ? (
          <form className="space-y-4" onSubmit={onSubmit} aria-busy={isSubmitting}>
            <div className="space-y-2">
              <Label htmlFor="password">新しいパスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="text-sm text-emerald-600" role="status">
                {success}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "更新中..." : "パスワードを更新"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <p>再設定メールのリンクからアクセスしてください。</p>
            <Link className="font-medium text-primary-600 hover:underline" href="/login">
              ログインへ戻る
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

