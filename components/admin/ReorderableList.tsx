"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

export type ReorderableItem = { id: string }

export default function ReorderableList<T extends ReorderableItem>({
  tenant,
  reorderPath,
  initialItems,
  disabled = false,
  renderItem,
}: {
  tenant: string
  reorderPath: string
  initialItems: T[]
  disabled?: boolean
  renderItem: (item: T, index: number, controls: React.ReactNode) => React.ReactNode
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const persistOrder = async (next: T[]) => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/tenants/${tenant}${reorderPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((item) => item.id) }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string; detail?: string }
        throw new Error(payload.detail ?? payload.message ?? "並び替えに失敗しました。")
      }

      router.refresh()
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "並び替えに失敗しました。")
      setItems(initialItems)
    } finally {
      setSaving(false)
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return

    const next = [...items]
    const [removed] = next.splice(index, 1)
    next.splice(target, 0, removed)
    setItems(next)
    void persistOrder(next)
  }

  const controls = (index: number) => (
    <div className="flex shrink-0 flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="h-7 w-7"
        disabled={disabled || saving || index === 0}
        onClick={() => move(index, -1)}
        aria-label="上へ"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="h-7 w-7"
        disabled={disabled || saving || index === items.length - 1}
        onClick={() => move(index, 1)}
        aria-label="下へ"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )

  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {disabled ? (
        <p className="text-xs text-cream-700">タグで絞り込み中は並び替えできません。</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saving ? <p className="text-xs text-cream-700">並び替えを保存中...</p> : null}
      {items.map((item, index) => (
        <div key={item.id}>{renderItem(item, index, controls(index))}</div>
      ))}
    </div>
  )
}
