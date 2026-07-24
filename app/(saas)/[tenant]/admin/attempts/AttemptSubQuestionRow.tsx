"use client"

import { Badge } from "@/components/ui/badge"

type AttemptSubQuestionRowProps = {
  title: string
  problemPrompt: string | null
  categoryTags: string[]
  userAnswerDisplay: string
  modelAnswerDisplay: string
  explanation: string | null
  isCorrect: boolean | null
}

function ResultMark({ isCorrect }: { isCorrect: boolean | null }) {
  if (isCorrect === true) {
    return <span className="shrink-0 font-medium text-emerald-700">正解</span>
  }
  if (isCorrect === false) {
    return <span className="shrink-0 font-medium text-red-700">不正解</span>
  }
  return <span className="shrink-0 text-slate-400">—</span>
}

export default function AttemptSubQuestionRow({
  title,
  problemPrompt,
  categoryTags,
  userAnswerDisplay,
  modelAnswerDisplay,
  explanation,
  isCorrect,
}: AttemptSubQuestionRowProps) {
  return (
    <details className="rounded-md border border-cream-200 bg-white open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate text-slate-900">{title}</span>
        <ResultMark isCorrect={isCorrect} />
      </summary>
      <div className="space-y-3 border-t border-cream-200 bg-cream-50 px-3 py-3 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">カテゴリ</p>
          {categoryTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categoryTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-slate-700">（未設定）</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">問題文</p>
          <p className="whitespace-pre-wrap text-slate-900">
            {problemPrompt?.trim() ? problemPrompt : "（問題文なし）"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">解答</p>
          <p className="whitespace-pre-wrap text-slate-900">{userAnswerDisplay}</p>
        </div>
        {isCorrect === false ? (
          <div className="rounded-md border border-emerald-100 bg-emerald-50/50 px-3 py-2">
            <p className="mb-1 text-xs font-semibold text-emerald-800">模範解答</p>
            <p className="whitespace-pre-wrap text-sm text-red-600">{modelAnswerDisplay}</p>
          </div>
        ) : null}
        {explanation?.trim() ? (
          <div className="rounded-md border border-cream-300 bg-white px-3 py-2">
            <p className="mb-1 text-xs font-semibold text-slate-500">解説</p>
            <p className="whitespace-pre-wrap text-slate-900">{explanation}</p>
          </div>
        ) : null}
      </div>
    </details>
  )
}
