"use client"

import { useState } from "react"
import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminUserCreatePage() {
  const params = useParams()
  const tenant =
    typeof params.tenant === "string"
      ? params.tenant
      : Array.isArray(params.tenant)
        ? params.tenant[0]
        : ""

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const loginId = String(formData.get("loginId") ?? "")
    const displayName = String(formData.get("displayName") ?? "")
    const password = String(formData.get("password") ?? "")

    try {
      const response = await fetch(`/api/tenants/${tenant}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId,
          displayName: displayName.trim().length > 0 ? displayName : undefined,
          password,
        }),
      })

      const payload = (await response.json()) as { message?: string; detail?: string; loginId?: string }
      if (!response.ok) {
        throw new Error(payload.detail ?? payload.message ?? "作成に失敗しました。")
      }

      setSuccess(`ユーザーを作成しました。ログインID: ${payload.loginId ?? loginId}`)
      ;(event.currentTarget as HTMLFormElement).reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラーが発生しました。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザー作成（受講者）</CardTitle>
        <CardDescription>
          テナント内でユニークなログインIDとパスワードで受講者を作成します。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} aria-busy={isSubmitting}>
          <div className="space-y-2">
            <Label htmlFor="loginId">ログインID</Label>
            <Input
              id="loginId"
              name="loginId"
              required
              placeholder="例: taro01"
              autoComplete="off"
            />
            <p className="text-xs text-slate-500">英数字と `-` `_` のみ、3〜32文字。</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">表示名（任意）</Label>
            <Input id="displayName" name="displayName" placeholder="例: 太郎" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">初期パスワード</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "作成中..." : "作成"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

