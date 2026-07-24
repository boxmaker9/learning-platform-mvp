"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import AttemptSubQuestionRow from "./AttemptSubQuestionRow"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { HistoryListEntry } from "@/lib/attempts/history"

export type { HistoryListEntry, HistorySubQuestion } from "@/lib/attempts/history"

type AttemptHistorySectionProps = {
  tenant: string
  entries: HistoryListEntry[]
  allowDelete?: boolean
}

function stopToggle(event: React.MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export default function AttemptHistorySection({
  tenant,
  entries,
  allowDelete = true,
}: AttemptHistorySectionProps) {
  const router = useRouter()
  const [selectionMode, setSelectionMode] = useState(false)
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

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedKeys(new Set())
  }

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

      exitSelectionMode()
      router.refresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "削除に失敗しました。")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1">
          <CardTitle>履歴一覧</CardTitle>
          <CardDescription>
            {allowDelete
              ? "大問は「1回の挑戦」ごとに1行表示します。「履歴削除」を押すと選択モードになり、個別または複数の履歴を選んで削除できます。大問を選ぶとその回の小問すべてが削除されます。日時は日本時間（Asia/Tokyo）です。"
              : "大問は「1回の挑戦」ごとに1行表示します。日時は日本時間（Asia/Tokyo）です。"}
          </CardDescription>
        </div>
        {allowDelete ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {selectionMode ? (
            <>
              <Button type="button" variant="secondary" onClick={exitSelectionMode} disabled={isDeleting}>
                キャンセル
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={selectedKeys.size === 0 || isDeleting}
                onClick={() => void onDelete()}
              >
                {isDeleting ? "削除中..." : `削除する（${selectedKeys.size}）`}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={entries.length === 0}
              onClick={() => setSelectionMode(true)}
            >
              履歴削除
            </Button>
          )}
        </div>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-cream-700">該当する解答履歴がありません。</p>
        ) : (
          <div className="space-y-3">
            {allowDelete && selectionMode ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-100 bg-red-50/50 px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-cream-900">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="すべて選択"
                  />
                  すべて選択
                </label>
                <span className="text-sm text-cream-800">{selectedKeys.size} 件選択中</span>
              </div>
            ) : null}

            {entries.map((entry) => {
              const checked = selectedKeys.has(entry.key)

              if (entry.kind === "standalone") {
                const row = entry.subQuestions[0]
                return (
                  <div
                    key={entry.key}
                    className={
                      allowDelete && selectionMode && checked
                        ? "rounded-md border border-red-200 bg-red-50/30 px-3 py-2"
                        : "rounded-md border border-cream-300 bg-white px-3 py-2"
                    }
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-cream-800">
                        {allowDelete && selectionMode ? (
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleKey(entry.key, value === true)}
                            aria-label={`${entry.deleteLabel} を選択`}
                          />
                        ) : null}
                        <span className="font-medium text-cream-700">単独小問</span>
                      </div>
                      <span className="text-xs text-cream-800">
                        {entry.standaloneDate}
                        {entry.userLabel ? (
                          <span className="ml-2 text-cream-700">· {entry.userLabel}</span>
                        ) : null}
                      </span>
                    </div>
                    {row ? (
                      <AttemptSubQuestionRow
                        title={row.title}
                        problemPrompt={row.problemPrompt}
                        categoryTags={row.categoryTags}
                        userAnswerDisplay={row.userAnswerDisplay}
                        modelAnswerDisplay={row.modelAnswerDisplay}
                        explanation={row.explanation}
                        isCorrect={row.isCorrect}
                      />
                    ) : null}
                  </div>
                )
              }

              return (
                <details
                  key={entry.key}
                  className={
                    allowDelete && selectionMode && checked
                      ? "group rounded-md border border-red-200 bg-red-50/30 open:shadow-sm"
                      : "group rounded-md border border-cream-300 bg-white open:shadow-sm"
                  }
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 whitespace-nowrap px-4 py-3 text-sm hover:bg-cream-100 [&::-webkit-details-marker]:hidden">
                    {allowDelete && selectionMode ? (
                      <span onClick={stopToggle} onKeyDown={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleKey(entry.key, value === true)}
                          aria-label={`${entry.deleteLabel} を選択`}
                        />
                      </span>
                    ) : null}
                    <span
                      className="shrink-0 text-xs text-cream-700 transition-transform group-open:rotate-180"
                      aria-hidden
                    >
                      ▼
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      <span className="truncate font-medium text-cream-900">{entry.groupTitle}</span>
                      <span className="shrink-0 text-cream-700">（{entry.scoreTotal}門）</span>
                      <span className="shrink-0 font-medium tabular-nums text-cream-900">
                        {entry.scoreCorrect}/{entry.scoreTotal}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-cream-800">
                      {entry.sessionDate}
                      {entry.userLabel ? (
                        <span className="ml-2 text-cream-700">· {entry.userLabel}</span>
                      ) : null}
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-cream-200 px-2 pb-3 pt-2">
                    {entry.subQuestions.map((row) => (
                      <AttemptSubQuestionRow
                        key={row.id}
                        title={row.title}
                        problemPrompt={row.problemPrompt}
                        categoryTags={row.categoryTags}
                        userAnswerDisplay={row.userAnswerDisplay}
                        modelAnswerDisplay={row.modelAnswerDisplay}
                        explanation={row.explanation}
                        isCorrect={row.isCorrect}
                      />
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
