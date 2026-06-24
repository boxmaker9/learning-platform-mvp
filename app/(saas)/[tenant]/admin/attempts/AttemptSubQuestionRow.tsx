"use client"

type AttemptSubQuestionRowProps = {
  title: string
  problemPrompt: string | null
  userAnswerDisplay: string
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
  userAnswerDisplay,
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
          <p className="mb-1 text-xs font-semibold text-slate-500">問題文</p>
          <p className="whitespace-pre-wrap text-slate-900">
            {problemPrompt?.trim() ? problemPrompt : "（問題文なし）"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">解答</p>
          <p className="whitespace-pre-wrap text-slate-900">{userAnswerDisplay}</p>
        </div>
      </div>
    </details>
  )
}
