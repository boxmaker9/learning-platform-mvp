"use client"

import { useState } from "react"
import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminGroupCreatePage() {
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
    const title = String(formData.get("title") ?? "").trim()

    try {
      const response = await fetch(`/api/tenants/${tenant}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string; detail?: string }
        throw new Error(payload.detail ?? payload.message ?? "作成に失敗しました。")
      }

      setSuccess("大問を作成しました。")
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
        <CardTitle>大問を作成</CardTitle>
        <CardDescription>大問（問題セット）のタイトルを作成します。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} aria-busy={isSubmitting}>
          <div className="space-y-2">
            <Label htmlFor="title">大問タイトル</Label>
            <Input id="title" name="title" required placeholder="例: 大問1（通信回線の基礎）" />
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

