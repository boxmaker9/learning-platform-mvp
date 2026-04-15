"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

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
  modelAnswerDisplay: string
  options: ProblemOption[]
}

type StoredAnswer = {
  userAnswer: string
  isCorrect: boolean | null
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
  const [answersByProblemId, setAnswersByProblemId] = useState<
    Record<string, StoredAnswer>
  >({})

  const total = problems.length
  const current = index < total ? problems[index] : undefined

  const progressLabel = useMemo(() => {
    if (total === 0) return "0 / 0"
    if (index >= total) return `${total} / ${total}`
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

  if (index >= total) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-4">
              <span>{groupTitle}</span>
              <span className="text-sm font-normal text-slate-500">{progressLabel}</span>
            </CardTitle>
            <CardDescription>各小問のあなたの解答と模範解答の対照です。</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>解答一覧</CardTitle>
            <CardDescription>
              未送信の小問は「あなたの解答」が「未解答」と表示されます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {problems.map((p, i) => {
              const row = answersByProblemId[p.id]
              return (
                <section
                  key={p.id}
                  className="border-b border-slate-200 pb-6 last:border-b-0 last:pb-0"
                >
                  <h3 className="text-base font-semibold text-slate-900">
                    {i + 1}. {p.title}
                  </h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2">
                      <p className="mb-1 text-xs font-semibold text-slate-500">あなたの解答</p>
                      <p className="whitespace-pre-wrap text-sm text-slate-800">
                        {row?.userAnswer ?? "未解答"}
                      </p>
                      {row?.isCorrect === true ? (
                        <p className="mt-2 text-xs font-medium text-emerald-700">正解</p>
                      ) : null}
                      {row?.isCorrect === false ? (
                        <p className="mt-2 text-xs font-medium text-red-700">不正解</p>
                      ) : null}
                      {row?.isCorrect === null && row ? (
                        <p className="mt-2 text-xs text-slate-600">（この場では正誤なし）</p>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                      <p className="mb-1 text-xs font-semibold text-emerald-800">模範解答</p>
                      <p className="whitespace-pre-wrap text-sm text-slate-800">
                        {p.modelAnswerDisplay}
                      </p>
                    </div>
                  </div>
                </section>
              )
            })}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIndex(total - 1)}>
                最後の小問に戻る
              </Button>
              <Link
                href={`/${tenant}/problems`}
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                問題一覧へ
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!current) {
    return null
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
            全{total}問。回答を送信すると正誤と解説が表示されます。確認したら「次の小問」で進み、最後は「解答一覧を見る」でまとめを表示できます。
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
              setAnswersByProblemId((prev) => ({
                ...prev,
                [current.id]: {
                  userAnswer: result.userAnswerDisplay,
                  isCorrect: result.isCorrect,
                },
              }))
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
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
            {index < total - 1 ? (
              <Button
                type="button"
                onClick={() => setIndex((prev) => Math.min(prev + 1, total - 1))}
              >
                次の小問
              </Button>
            ) : (
              <Button type="button" onClick={() => setIndex(total)}>
                解答一覧を見る
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
