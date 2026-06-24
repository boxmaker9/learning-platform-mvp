"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { X } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import ProblemAttemptForm from "../../problems/[problemId]/ProblemAttemptForm"

type ProblemOption = {
  id: string
  label: string
  /** 答え合わせ一覧で正解マークに使う（受講フォームでは未使用でも可） */
  isCorrect?: boolean
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
  submittedValues: {
    answerText: string
    selectedOptionId: string
    selectedOptionIds: Record<string, boolean>
  }
}

function userPickedOption(
  type: GroupProblem["type"],
  optionId: string,
  submitted?: StoredAnswer["submittedValues"]
): boolean {
  if (!submitted) return false
  if (type === "single_choice") {
    return submitted.selectedOptionId === optionId
  }
  if (type === "multiple_choice") {
    return Boolean(submitted.selectedOptionIds?.[optionId])
  }
  return false
}

function AnswerResultMark({ isCorrect }: { isCorrect: boolean | null | undefined }) {
  if (isCorrect === true) {
    return (
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center"
        role="img"
        aria-label="正解"
      >
        <span className="select-none text-2xl font-light leading-none text-emerald-600">○</span>
      </span>
    )
  }
  if (isCorrect === false) {
    return (
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-red-600"
        role="img"
        aria-label="不正解"
      >
        <X className="h-6 w-6" strokeWidth={2.75} />
      </span>
    )
  }
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-cream-400"
      role="img"
      aria-label="未解答"
    >
      <span className="select-none text-lg leading-none">—</span>
    </span>
  )
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
  const [answersByProblemId, setAnswersByProblemId] = useState<
    Record<string, StoredAnswer>
  >({})

  const total = problems.length
  const current = index < total ? problems[index] : undefined
  const currentStored = current ? answersByProblemId[current.id] : undefined

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
              <span className="text-sm font-normal text-cream-700">{progressLabel}</span>
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
                  className="border-b border-cream-300 pb-6 last:border-b-0 last:pb-0"
                >
                  <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-cream-900">
                    <AnswerResultMark isCorrect={row?.isCorrect} />
                    <span>
                      {i + 1}. {p.title}
                    </span>
                  </h3>
                  {p.prompt ? (
                    <div className="mt-3 rounded-md border border-cream-200 bg-cream-100/80 px-3 py-2">
                      <p className="mb-1 text-xs font-semibold text-cream-700">問題文</p>
                      <p className="whitespace-pre-wrap text-sm text-cream-900">{p.prompt}</p>
                    </div>
                  ) : null}
                  {p.type !== "text" && p.options.length > 0 ? (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-semibold text-cream-700">選択肢</p>
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-cream-900">
                        {p.options.map((opt) => {
                          const picked = userPickedOption(p.type, opt.id, row?.submittedValues)
                          const isModel = Boolean(opt.isCorrect)
                          return (
                            <li key={opt.id} className="pl-1 marker:font-normal">
                              <span className="whitespace-pre-wrap">{opt.label}</span>
                              <span className="ml-2 inline-flex flex-wrap gap-1.5 align-middle">
                                {isModel ? (
                                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
                                    正解
                                  </span>
                                ) : null}
                                {picked ? (
                                  <span className="rounded bg-cream-300 px-1.5 py-0.5 text-xs font-medium text-cream-900">
                                    あなたの選択
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-md border border-cream-300 bg-cream-100/80 px-3 py-2">
                      <p className="mb-1 text-xs font-semibold text-cream-700">あなたの解答</p>
                      <p className="whitespace-pre-wrap text-sm text-cream-900">
                        {row?.userAnswer ?? "未解答"}
                      </p>
                      {row?.isCorrect === true ? (
                        <p className="mt-2 text-xs font-medium text-emerald-700">正解</p>
                      ) : null}
                      {row?.isCorrect === false ? (
                        <p className="mt-2 text-xs font-medium text-red-700">不正解</p>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                      <p className="mb-1 text-xs font-semibold text-emerald-800">模範解答</p>
                      <p className="whitespace-pre-wrap text-sm text-red-600">
                        {p.modelAnswerDisplay}
                      </p>
                    </div>
                  </div>
                  {p.explanation ? (
                    <details className="mt-4 rounded-md border border-cream-300 bg-cream-50 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-cream-900">
                        解説を表示
                      </summary>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-cream-900">
                        {p.explanation}
                      </div>
                    </details>
                  ) : null}
                </section>
              )
            })}

            <div className="flex flex-wrap gap-3 pt-2">
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
            <span className="text-sm font-normal text-cream-700">{progressLabel}</span>
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
            locked={Boolean(currentStored)}
            initialValues={currentStored?.submittedValues}
            onSubmitted={(result) => {
              setAnswersByProblemId((prev) => ({
                ...prev,
                [current.id]: {
                  userAnswer: result.userAnswerDisplay,
                  isCorrect: result.isCorrect,
                  submittedValues: result.submittedValues,
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
