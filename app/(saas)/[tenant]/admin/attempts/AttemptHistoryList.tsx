"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import AttemptSubQuestionRow from "./AttemptSubQuestionRow"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

export type HistorySubQuestion = {
  id: string
  title: string
  problemPrompt: string | null
  userAnswerDisplay: string
  isCorrect: boolean | null
}

export type HistoryListEntry = {
  key: string
  kind: "standalone" | "group_session"
  attemptIds: string[]
  deleteLabel: string
  subQuestions: HistorySubQuestion[]
  groupTitle?: string
  sessionDate?: string
  userLabel?: string
  scoreCorrect?: number
  scoreTotal?: number
  standaloneDate?: string
}

type AttemptHistoryListProps = {
  tenant: string
  entries: HistoryListEntry[]
}

function stopToggle(event: React.MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export default function AttemptHistoryList({ tenant, entries }: AttemptHistoryListProps) {
  const router = useRouter()
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const allKeys = useMemo(() => entries.map((e) => e.key), [entries])
  const allSelected = entries.length > 0 && selectedKeys.size === entries.length

  const selectedAttemptIds = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of entries) {
      if (selectedKeys.has(entry.key)) {
        for (const id of entry.attemptIds) {
          ids.add(id)
        }
      }
    }
    return Array.from(ids)
  }, [entries, selectedKeys])

  const toggleKey = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelectedKeys(checked ? new Set(allKeys) : new Set())
  }

  const onDelete = async () => {
    if (selectedKeys.size === 0) return

    const ok = window.confirm(
      `選択した ${selectedKeys.size} 件の履歴を削除してもよろしいですか？`
    )
    if (!ok) return

    const okAgain = window.confirm(
      "本当に削除しますか？解答履歴はサーバーから削除されます。"
    )
    if (!okAgain) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tenants/${tenant}/attempts/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptIds: selectedAttemptIds }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string; detail?: string }
        throw new Error(payload.detail ?? payload.message ?? "削除に失敗しました。")
      }

      setSelectedKeys(new Set())
      router.refresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "削除に失敗しました。")
    } finally {
      setIsDeleting(false)
    }
  }

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">該当する解答履歴がありません。</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked === true)}
            aria-label="すべて選択"
          />
          すべて選択
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">{selectedKeys.size} 件選択中</span>
          <Button
            type="button"
            variant="destructive"
            disabled={selectedKeys.size === 0 || isDeleting}
            onClick={() => void onDelete()}
          >
            {isDeleting ? "削除中..." : "履歴削除"}
          </Button>
        </div>
      </div>

      {entries.map((entry) => {
        const checked = selectedKeys.has(entry.key)

        if (entry.kind === "standalone") {
          const row = entry.subQuestions[0]
          return (
            <div
              key={entry.key}
              className="rounded-md border border-slate-200 bg-white px-3 py-2"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleKey(entry.key, value === true)}
                    aria-label={`${entry.deleteLabel} を選択`}
                  />
                  <span className="font-medium text-slate-500">単独小問</span>
                </label>
                <span className="text-xs text-slate-600">
                  {entry.standaloneDate}
                  {entry.userLabel ? (
                    <span className="ml-2 text-slate-500">· {entry.userLabel}</span>
                  ) : null}
                </span>
              </div>
              {row ? (
                <AttemptSubQuestionRow
                  title={row.title}
                  problemPrompt={row.problemPrompt}
                  userAnswerDisplay={row.userAnswerDisplay}
                  isCorrect={row.isCorrect}
                />
              ) : null}
            </div>
          )
        }

        return (
          <details
            key={entry.key}
            className="group rounded-md border border-slate-200 bg-white open:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 whitespace-nowrap px-4 py-3 text-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span onClick={stopToggle} onKeyDown={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggleKey(entry.key, value === true)}
                  aria-label={`${entry.deleteLabel} を選択`}
                />
              </span>
              <span
                className="shrink-0 text-xs text-slate-500 transition-transform group-open:rotate-180"
                aria-hidden
              >
                ▼
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <span className="truncate font-medium text-slate-900">{entry.groupTitle}</span>
                <span className="shrink-0 text-slate-500">（{entry.scoreTotal}門）</span>
                <span className="shrink-0 font-medium tabular-nums text-slate-700">
                  {entry.scoreCorrect}/{entry.scoreTotal}
                </span>
              </span>
              <span className="shrink-0 text-xs text-slate-600">
                {entry.sessionDate}
                {entry.userLabel ? (
                  <span className="ml-2 text-slate-500">· {entry.userLabel}</span>
                ) : null}
              </span>
            </summary>
            <div className="space-y-2 border-t border-slate-100 px-2 pb-3 pt-2">
              {entry.subQuestions.map((row) => (
                <AttemptSubQuestionRow
                  key={row.id}
                  title={row.title}
                  problemPrompt={row.problemPrompt}
                  userAnswerDisplay={row.userAnswerDisplay}
                  isCorrect={row.isCorrect}
                />
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}
