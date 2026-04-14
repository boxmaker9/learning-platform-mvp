"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import GroupProblemForm from "../GroupProblemForm"

type GroupRow = { id: string; title: string }

export default function AdminGroupCreatePage() {
  const params = useParams()
  const tenant =
    typeof params.tenant === "string"
      ? params.tenant
      : Array.isArray(params.tenant)
        ? params.tenant[0]
        : ""

  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [selectedGroupTitle, setSelectedGroupTitle] = useState<string>("")

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch(`/api/tenants/${tenant}/groups`)
        if (!response.ok) return
        const payload = (await response.json()) as { groups?: GroupRow[] }
        const list = payload.groups ?? []
        setGroups(list)
      } catch {
        // ignore
      }
    }
    void run()
  }, [tenant])

  const selectedTitle = useMemo(() => {
    const found = groups.find((g) => g.id === selectedGroupId)
    return found?.title ?? selectedGroupTitle
  }, [groups, selectedGroupId, selectedGroupTitle])

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

      const payload = (await response.json()) as { id: string }
      setSuccess("大問を作成しました。続けて小問を作成できます。")
      formRef.current?.reset()
      setSelectedGroupId(payload.id)
      setSelectedGroupTitle(title)

      setGroups((prev) => [{ id: payload.id, title }, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラーが発生しました。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>大問を作成</CardTitle>
          <CardDescription>
            大問（問題セット）のタイトルを作成し、そのまま小問も作成できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            ref={formRef}
            className="space-y-4"
            onSubmit={onSubmit}
            aria-busy={isSubmitting}
          >
            <div className="space-y-2">
              <Label htmlFor="title">大問タイトル</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="例: 大問1（通信回線の基礎）"
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "作成中..." : "作成"}
            </Button>
          </form>

          <SeparatorBlock />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">既存の大問に小問を追加</p>
              <p className="text-xs text-slate-500">
                追加先の大問を選んでください（新規作成後は自動で選択されます）。
              </p>
            </div>
            <Select
              value={selectedGroupId}
              onValueChange={(value) => {
                setSelectedGroupId(value)
                const found = groups.find((g) => g.id === value)
                setSelectedGroupTitle(found?.title ?? "")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="大問を選択" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedGroupId ? (
        <GroupProblemForm
          tenant={tenant}
          groupId={selectedGroupId}
          groupTitle={selectedTitle}
        />
      ) : null}
    </div>
  )
}

function SeparatorBlock() {
  return <div className="h-px w-full bg-slate-200" />
}

