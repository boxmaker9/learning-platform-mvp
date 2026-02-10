"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function TenantCreatePage() {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") ?? "")
    const slug = String(formData.get("slug") ?? "").toLowerCase()

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message ?? "作成に失敗しました。")
      }

      const payload = (await response.json()) as { slug: string }
      window.location.href = `/${payload.slug}/admin/problems/new`
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラーが発生しました。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>テナントを作成</CardTitle>
          <CardDescription>組織名とURL用のスラッグを入力してください。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit} aria-busy={isSubmitting}>
            <div className="space-y-2">
              <Label htmlFor="name">組織名</Label>
              <Input id="name" name="name" required placeholder="例: Acme Inc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URLスラッグ</Label>
              <Input id="slug" name="slug" required placeholder="acme" />
              <p className="text-xs text-slate-500">
                半角英数字とハイフンのみ利用できます。
              </p>
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "作成中..." : "作成する"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

