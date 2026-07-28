type SessionScoreIndicatorProps = {
  correct: number
  total: number
  isPerfectScore: boolean
}

export default function SessionScoreIndicator({
  correct,
  total,
  isPerfectScore,
}: SessionScoreIndicatorProps) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span className="font-medium tabular-nums text-cream-900">
        {correct}/{total}
      </span>
      {isPerfectScore ? (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-xs font-bold leading-none text-sky-700"
          aria-label="全問正解"
          title="全問正解"
        >
          ○
        </span>
      ) : (
        <span
          className="inline-flex h-5 w-5 items-center justify-center text-base font-bold leading-none text-red-600"
          aria-label="未満点"
          title="未満点"
        >
          ×
        </span>
      )}
    </span>
  )
}
