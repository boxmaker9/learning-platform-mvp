import AttemptHistorySection from "@/app/(saas)/[tenant]/admin/attempts/AttemptHistoryList"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LoadedAttemptHistory } from "@/lib/attempts/history"
import type { ReactNode } from "react"

type AttemptHistoryViewProps = {
  tenant: string
  organizationName: string
  introDescription: string
  statsScopeDescription: string
  categoryTop3Description?: string
  data: LoadedAttemptHistory
  allowDelete?: boolean
  beforeHistoryList?: ReactNode
}

export default function AttemptHistoryView({
  tenant,
  organizationName,
  introDescription,
  statsScopeDescription,
  categoryTop3Description,
  data,
  allowDelete = true,
  beforeHistoryList,
}: AttemptHistoryViewProps) {
  const {
    historyEntries,
    groupSessionCount,
    attemptCount,
    gradedCount,
    correctCount,
    ratePercent,
    topCategoryLowCorrectRates,
  } = data

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>解答履歴</CardTitle>
          <CardDescription>{introDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-cream-800">
          <p>
            記述式は自動採点していないため「結果」は「—」ですが、展開すると記述解答を確認できます。択一・複数選択は送信時の正誤が記録されます。
          </p>
          <p className="text-xs text-cream-700">{organizationName}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>集計（表示中の範囲）</CardTitle>
          <CardDescription>{statsScopeDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-cream-300 bg-cream-200 px-4 py-3">
            <p className="text-xs font-semibold text-cream-700">小問の送信回数</p>
            <p className="mt-1 text-2xl font-semibold text-cream-900">{attemptCount}</p>
            <p className="mt-1 text-xs text-cream-700">大問の挑戦 {groupSessionCount} 回</p>
          </div>
          <div className="rounded-md border border-cream-300 bg-cream-200 px-4 py-3">
            <p className="text-xs font-semibold text-cream-700">採点済み（択一・複数選択）</p>
            <p className="mt-1 text-2xl font-semibold text-cream-900">{gradedCount}</p>
          </div>
          <div className="rounded-md border border-cream-300 bg-cream-200 px-4 py-3">
            <p className="text-xs font-semibold text-cream-700">正答率（採点済みのみ）</p>
            <p className="mt-1 text-2xl font-semibold text-cream-900">
              {ratePercent === null ? "—" : `${ratePercent}%`}
            </p>
            {gradedCount > 0 ? (
              <p className="mt-1 text-xs text-cream-700">
                正解 {correctCount} / {gradedCount}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {topCategoryLowCorrectRates.length > 0 || categoryTop3Description ? (
        <Card>
          <CardHeader>
            <CardTitle>カテゴリ別 低正答率 TOP3</CardTitle>
            <CardDescription>
              {categoryTop3Description ??
                "表示中データ（直近6ヶ月・採点済みのみ）から、正答率が低いカテゴリを自動集計しています。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topCategoryLowCorrectRates.length === 0 ? (
              <p className="text-sm text-cream-700">
                カテゴリタグ付きの採点済み解答がまだありません。
              </p>
            ) : (
              <ol className="space-y-3">
                {topCategoryLowCorrectRates.map((row, index) => (
                  <li
                    key={row.tag}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-cream-300 bg-cream-200 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-cream-900 shadow-sm">
                        {index + 1}
                      </span>
                      <span className="truncate font-medium text-cream-900">{row.tag}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-cream-900">
                        正答率 {row.correctRatePercent}%
                      </p>
                      <p className="text-xs text-cream-700">
                        正解 {row.correctCount} / 採点済み {row.gradedCount}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      ) : null}

      {beforeHistoryList}

      <AttemptHistorySection
        tenant={tenant}
        entries={historyEntries}
        allowDelete={allowDelete}
      />
    </div>
  )
}
