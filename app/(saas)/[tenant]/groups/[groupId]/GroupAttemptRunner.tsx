"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import ProblemAttemptForm from "../../problems/[problemId]/ProblemAttemptForm"

type ProblemOption = {
  id: string
  label: string
}

export type GroupProblem = {
  id: string
  title: string
  prompt: string | null
  explanation: string | null
  type: "single_choice" | "multiple_choice" | "text"
  options: ProblemOption[]
}

export default function GroupAttemptRunner({
  tenant,
  groupTitle,
  problems,
}: {
  tenant: string
  groupTitle: string
  problems: GroupProblem[]
}) {
  const [index, setIndex] = useState(0)
  const [lastResult, setLastResult] = useState<boolean | null | undefined>(undefined)

  const current = problems[index]
  const total = problems.length

  const progressLabel = useMemo(() => {
    if (total === 0) return "0 / 0"
    return `${index + 1} / ${total}`
  }, [index, total])

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>大問に問題がありません</CardTitle>
          <CardDescription>管理者が小問を追加すると解答できます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>完了</CardTitle>
          <CardDescription>この大問の解答が完了しました。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>{groupTitle}</span>
            <span className="text-sm font-normal text-slate-500">{progressLabel}</span>
          </CardTitle>
          <CardDescription>
            全{total}問。回答を送信すると正誤と解説が表示されます。確認したら「次の小問」で進んでください。
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{current.title}</CardTitle>
          {current.prompt ? (
            <CardDescription className="whitespace-pre-wrap">{current.prompt}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <ProblemAttemptForm
            key={current.id}
            tenant={tenant}
            problemId={current.id}
            type={current.type}
            options={current.options}
            explanation={current.explanation}
            onSubmitted={(result) => {
              setLastResult(result.isCorrect)
            }}
          />

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}
              disabled={index === 0}
            >
              前の小問
            </Button>
            <div className="text-xs text-slate-500">
              {lastResult === true ? "直前: 正解" : lastResult === false ? "直前: 不正解" : null}
            </div>
            <Button
              type="button"
              onClick={() => setIndex((prev) => Math.min(prev + 1, total))}
              disabled={index >= total - 1}
            >
              次の小問
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

