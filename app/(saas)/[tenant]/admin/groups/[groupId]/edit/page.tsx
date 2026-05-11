"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type GroupRow = {
  id: string
  title: string
  tags: string[] | null
}

export default function AdminGroupEditPage() {
  const params = useParams()
  const tenant =
    typeof params.tenant === "string"
      ? params.tenant
      : Array.isArray(params.tenant)
        ? params.tenant[0]
        : ""
  const groupId =
    typeof params.groupId === "string"
      ? params.groupId
      : Array.isArray(params.groupId)
        ? params.groupId[0]
        : ""

  const [title, setTitle] = useState("")
  const [tagsText, setTagsText] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!tenant || !groupId) return
    let cancelled = false
    const run = async () => {
      setLoadError(null)
      try {
        const response = await fetch(`/api/tenants/${tenant}/groups/${groupId}`)
        if (!response.ok) {
          const payload = (await response.json()) as { message?: string }
          throw new Error(payload.message ?? "読み込みに失敗しました。")
        }
        const payload = (await response.json()) as { group: GroupRow }
        if (cancelled) return
        setTitle(payload.group.title ?? "")
        setTagsText((payload.group.tags ?? []).join(", "))
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "読み込みに失敗しました。")
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [tenant, groupId])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)
    setIsSubmitting(true)

    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      const response = await fetch(`/api/tenants/${tenant}/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, tags }),
      })
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string; detail?: string }
        throw new Error(payload.detail ?? payload.message ?? "保存に失敗しました。")
      }
      setSubmitSuccess(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "通信エラーが発生しました。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>大問を編集</CardTitle>
          <CardDescription>大問のタイトルやタグを編集できます。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="secondary">
            <Link href={`/${tenant}/admin/groups`}>大問一覧へ戻る</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/${tenant}/admin/groups/${groupId}`}>大問詳細へ戻る</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>編集内容</CardTitle>
          <CardDescription>保存すると受講者側にも反映されます。</CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="mb-4 text-sm text-red-600" role="alert">
              {loadError}
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={onSubmit} aria-busy={isSubmitting}>
            <div className="space-y-2">
              <Label htmlFor="title">大問タイトル</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">カテゴリタグ (任意)</Label>
              <Input
                id="tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.currentTarget.value)}
                placeholder="例: 回線, 基礎, SB"
              />
              <p className="text-xs text-slate-500">カンマ区切りで複数指定できます。</p>
            </div>

            {submitError ? (
              <p className="text-sm text-red-600" role="alert">
                {submitError}
              </p>
            ) : null}
            {submitSuccess ? (
              <p className="text-sm text-emerald-600" role="status">
                保存が完了しました。
              </p>
            ) : null}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

