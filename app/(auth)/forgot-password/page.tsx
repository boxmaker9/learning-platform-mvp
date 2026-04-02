"use client"

import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "")

    try {
      const response = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message ?? "送信に失敗しました。")
      }

      setSuccess("再設定メールを送信しました。受信箱をご確認ください。")
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
        <CardTitle>パスワード再設定</CardTitle>
        <CardDescription>登録したメールアドレスに再設定リンクを送信します。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} aria-busy={isSubmitting}>
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
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
            {isSubmitting ? "送信中..." : "再設定メールを送信"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-slate-500">
          ログイン画面へ戻る場合は{" "}
          <Link className="font-medium text-primary-600 hover:underline" href="/login">
            こちら
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

