import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type AttemptRow = {
  id: string
  created_at: string
  is_correct: boolean | null
  user_id: string
  problem_id: string
  problemTitle: string
  problemType: "single_choice" | "multiple_choice" | "text"
  problemPosition: number
  problemGroupId: string | null
  problemGroupTitle: string | null
  answerText: string | null
}

/** 大問の1回分（受講者が大問を通しで解いた単位） */
type GroupAttemptSession = {
  key: string
  userId: string
  groupId: string
  groupTitle: string
  /** 大問に取り組み始めた時刻（最初に送信した小問の日時） */
  sessionAt: string
  latestIso: string
  attempts: AttemptRow[]
}

type StandaloneAttemptItem = {
  kind: "standalone"
  key: string
  sortKey: string
  attempt: AttemptRow
}

type GroupSessionListItem = {
  kind: "group_session"
  key: string
  sortKey: string
  session: GroupAttemptSession
}

type HistoryListItem = StandaloneAttemptItem | GroupSessionListItem

type ProfileRow = {
  user_id: string
  login_id: string
  display_name: string | null
}

function sixMonthsAgoIso() {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d.toISOString()
}

function formatJaDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function sessionScore(attempts: AttemptRow[]) {
  const total = attempts.length
  const correct = attempts.filter((a) => a.is_correct === true).length
  return { correct, total }
}

function formatTextAnswer(answerText: string | null) {
  const t = answerText?.trim() ?? ""
  return t.length > 0 ? t : "（未入力）"
}

function attemptResultMark(row: AttemptRow) {
  if (row.is_correct === true) {
    return <span className="font-medium text-emerald-700">正解</span>
  }
  if (row.is_correct === false) {
    return <span className="font-medium text-red-700">不正解</span>
  }
  return <span className="text-slate-400">—</span>
}

/** PostgREST の 1:1 / N:1 embed が単体オブジェクトでも配列でも返る場合に先頭だけ取る */
function firstRelationRow<T extends Record<string, unknown>>(v: unknown): T | null {
  if (v == null) return null
  if (Array.isArray(v)) {
    const x = v[0]
    return x && typeof x === "object" ? (x as T) : null
  }
  if (typeof v === "object") return v as T
  return null
}

function parseProblemsJoin(problems: unknown): {
  problemTitle: string
  problemType: AttemptRow["problemType"]
  problemPosition: number
  problemGroupId: string | null
  problemGroupTitle: string | null
} {
  const row = firstRelationRow<{
    title?: unknown
    type?: unknown
    position?: unknown
    problem_group_id?: unknown
    problem_groups?: unknown
  }>(problems)

  if (!row) {
    return {
      problemTitle: "（タイトル不明）",
      problemType: "single_choice",
      problemPosition: 0,
      problemGroupId: null,
      problemGroupTitle: null,
    }
  }

  const problemTitle =
    typeof row.title === "string" && row.title.length > 0 ? row.title : "（タイトル不明）"

  const problemType: AttemptRow["problemType"] =
    row.type === "text" || row.type === "multiple_choice" || row.type === "single_choice"
      ? row.type
      : "single_choice"

  const problemPosition =
    typeof row.position === "number" && Number.isFinite(row.position) ? row.position : 0

  const gid =
    typeof row.problem_group_id === "string" && row.problem_group_id.length > 0
      ? row.problem_group_id
      : null

  const gRow = firstRelationRow<{ title?: unknown }>(row.problem_groups)
  const problemGroupTitle =
    gRow && typeof gRow.title === "string" && gRow.title.length > 0 ? gRow.title : null

  return { problemTitle, problemType, problemPosition, problemGroupId: gid, problemGroupTitle }
}

/**
 * 同一ユーザー・同一大問の解答を「1回の挑戦」ごとに分割する。
 * すでにその回に含まれる小問が再度送信されたら、新しい回として扱う。
 */
function clusterGroupAttemptsIntoSessions(rows: AttemptRow[]): GroupAttemptSession[] {
  if (rows.length === 0) return []

  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const sessionBuckets: AttemptRow[][] = []

  for (const attempt of sorted) {
    let placed = false
    for (let i = sessionBuckets.length - 1; i >= 0; i--) {
      const bucket = sessionBuckets[i]
      const hasProblem = bucket.some((x) => x.problem_id === attempt.problem_id)
      if (!hasProblem) {
        bucket.push(attempt)
        placed = true
        break
      }
    }
    if (!placed) {
      sessionBuckets.push([attempt])
    }
  }

  const userId = sorted[0].user_id
  const groupId = sorted[0].problemGroupId!
  const groupTitle =
    sorted[0].problemGroupTitle ?? "（大問情報の取得に失敗／削除済みの可能性）"

  return sessionBuckets.map((bucket, index) => {
    const ordered = [...bucket].sort((a, b) => {
      if (a.problemPosition !== b.problemPosition) {
        return a.problemPosition - b.problemPosition
      }
      return a.created_at.localeCompare(b.created_at)
    })
    const sessionAt = ordered[0].created_at
    const latestIso = ordered.reduce(
      (max, a) => (a.created_at > max ? a.created_at : max),
      ordered[0].created_at
    )
    return {
      key: `${userId}:${groupId}:${sessionAt}:${index}`,
      userId,
      groupId,
      groupTitle,
      sessionAt,
      latestIso,
      attempts: ordered,
    }
  })
}

function buildHistoryList(attempts: AttemptRow[]): HistoryListItem[] {
  const groupByUserAndGroup = new Map<string, AttemptRow[]>()
  const standalone: AttemptRow[] = []

  for (const a of attempts) {
    if (a.problemGroupId) {
      const mapKey = `${a.user_id}:${a.problemGroupId}`
      const list = groupByUserAndGroup.get(mapKey) ?? []
      list.push(a)
      groupByUserAndGroup.set(mapKey, list)
    } else {
      standalone.push(a)
    }
  }

  const items: HistoryListItem[] = []

  for (const rows of Array.from(groupByUserAndGroup.values())) {
    for (const session of clusterGroupAttemptsIntoSessions(rows)) {
      items.push({
        kind: "group_session",
        key: session.key,
        sortKey: session.latestIso,
        session,
      })
    }
  }

  for (const a of standalone) {
    items.push({
      kind: "standalone",
      key: a.id,
      sortKey: a.created_at,
      attempt: a,
    })
  }

  items.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  return items
}

export default async function AdminAttemptsHistoryPage({
  params,
  searchParams,
}: {
  params: { tenant: string }
  searchParams?: { userId?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>解答履歴</CardTitle>
          <CardDescription>ログインが必要です。</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm font-medium text-primary-600 hover:underline" href="/login">
            ログインへ
          </Link>
        </CardContent>
      </Card>
    )
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", params.tenant)
    .single()

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>解答履歴</CardTitle>
          <CardDescription>テナントが見つかりません。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userData.user.id)
    .single()

  if (!membership || membership.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>解答履歴</CardTitle>
          <CardDescription>管理者のみアクセスできます。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { data: studentMembers } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organization.id)
    .eq("role", "student")

  const studentIds = (studentMembers ?? []).map((m) => m.user_id).filter(Boolean)

  let profiles: ProfileRow[] = []
  if (studentIds.length > 0) {
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("user_id, login_id, display_name")
      .eq("organization_id", organization.id)
      .in("user_id", studentIds)
    profiles = (profs ?? []) as ProfileRow[]
  }

  const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]))

  const rawUserId =
    typeof searchParams?.userId === "string" && searchParams.userId.trim().length > 0
      ? searchParams.userId.trim()
      : ""

  const filterUserId =
    rawUserId && UUID_RE.test(rawUserId) && studentIds.includes(rawUserId) ? rawUserId : ""

  let attemptsQuery = supabase
    .from("problem_attempts")
    .select(
      "id, created_at, is_correct, user_id, problem_id, answer_text, problems(title, type, position, problem_group_id, problem_groups(title))"
    )
    .eq("organization_id", organization.id)
    .gte("created_at", sixMonthsAgoIso())
    .order("created_at", { ascending: false })
    .limit(2500)

  if (filterUserId) {
    attemptsQuery = attemptsQuery.eq("user_id", filterUserId)
  }

  const { data: attemptsRaw } = await attemptsQuery

  const attempts: AttemptRow[] = (attemptsRaw ?? []).map((row) => {
    const r = row as {
      id: string
      created_at: string
      is_correct: boolean | null
      user_id: string
      problem_id: string
      answer_text: string | null
      problems: unknown
    }
    const parsed = parseProblemsJoin(r.problems)
    return {
      id: r.id,
      created_at: r.created_at,
      is_correct: r.is_correct,
      user_id: r.user_id,
      problem_id: r.problem_id,
      problemTitle: parsed.problemTitle,
      problemType: parsed.problemType,
      problemPosition: parsed.problemPosition,
      problemGroupId: parsed.problemGroupId,
      problemGroupTitle: parsed.problemGroupTitle,
      answerText: r.answer_text,
    }
  })

  const historyItems = buildHistoryList(attempts)
  const groupSessionCount = historyItems.filter((i) => i.kind === "group_session").length

  const graded = attempts.filter((a) => a.is_correct !== null && a.is_correct !== undefined)
  const correctCount = graded.filter((a) => a.is_correct === true).length
  const gradedCount = graded.length
  const ratePercent =
    gradedCount === 0 ? null : Math.round((correctCount / gradedCount) * 1000) / 10

  const displayForUser = (uid: string) => {
    const p = profileByUserId.get(uid)
    if (p?.display_name?.trim()) return `${p.display_name} (${p.login_id})`
    if (p) return p.login_id
    return uid.slice(0, 8) + "…"
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>解答履歴</CardTitle>
          <CardDescription>
            {organization.name} の受講者の解答を確認できます。直近6ヶ月分のみ表示します（それ以前は定期的な削除の対象です）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p>
            記述式は自動採点していないため「結果」は「—」ですが、展開すると受講者の記述解答を確認できます。択一・複数選択は送信時の正誤が記録されます。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>集計（表示中の範囲）</CardTitle>
          <CardDescription>
            上の絞り込みを変えると、件数と正答率もその範囲に合わせて変わります。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">小問の送信回数</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{attempts.length}</p>
            <p className="mt-1 text-xs text-slate-500">大問の挑戦 {groupSessionCount} 回</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">採点済み（択一・複数選択）</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{gradedCount}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">正答率（採点済みのみ）</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {ratePercent === null ? "—" : `${ratePercent}%`}
            </p>
            {gradedCount > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                正解 {correctCount} / {gradedCount}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>受講者で絞り込み</CardTitle>
          <CardDescription>GET フォームで URL が変わります。ブックマークしやすい形です。</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1">
              <label htmlFor="userId" className="text-xs font-medium text-slate-600">
                受講者
              </label>
              <select
                id="userId"
                name="userId"
                defaultValue={filterUserId}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">すべての受講者</option>
                {profiles.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.display_name?.trim() ? `${p.display_name} (${p.login_id})` : p.login_id}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">適用</Button>
            {filterUserId ? (
              <Button asChild variant="secondary" type="button">
                <Link href={`/${params.tenant}/admin/attempts`}>解除</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>履歴一覧</CardTitle>
          <CardDescription>
            大問は「1回の挑戦」ごとに1行表示します（同じ大問を2回解いたら2行）。展開すると小問の結果が見られます。大問の日時は挑戦開始時刻です。大問に属さない小問は1問ごとに日時を表示します。日時は日本時間（Asia/Tokyo）です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 overflow-x-auto">
          {historyItems.length === 0 ? (
            <p className="text-sm text-slate-500">該当する解答履歴がありません。</p>
          ) : (
            historyItems.map((item) => {
              if (item.kind === "standalone") {
                const row = item.attempt
                return (
                  <details
                    key={item.key}
                    className="rounded-md border border-slate-200 bg-white open:shadow-sm"
                  >
                    <summary className="cursor-pointer px-4 py-3 text-sm hover:bg-slate-50">
                      <span className="inline-flex w-full flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">
                          {row.problemTitle}
                          <span className="ml-2 font-normal text-slate-500">（単独小問）</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-600">
                          {formatJaDate(row.created_at)}
                          {!filterUserId ? (
                            <span className="ml-2 text-slate-500">
                              · {displayForUser(row.user_id)}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </summary>
                    <div className="border-t border-slate-100 px-4 pb-3 pt-2">
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        {!filterUserId ? (
                          <div>
                            <dt className="text-xs font-semibold text-slate-500">受講者</dt>
                            <dd className="text-slate-800">{displayForUser(row.user_id)}</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt className="text-xs font-semibold text-slate-500">結果</dt>
                          <dd>{attemptResultMark(row)}</dd>
                        </div>
                        {row.problemType === "text" ? (
                          <div className={filterUserId ? "sm:col-span-2" : "sm:col-span-2"}>
                            <dt className="text-xs font-semibold text-slate-500">記述解答</dt>
                            <dd className="whitespace-pre-wrap text-slate-800">
                              {formatTextAnswer(row.answerText)}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </details>
                )
              }

              const { session } = item
              const showUser = !filterUserId
              const { correct, total } = sessionScore(session.attempts)
              return (
                <details
                  key={item.key}
                  className="group rounded-md border border-slate-200 bg-white open:shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 whitespace-nowrap px-4 py-3 text-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <span
                      className="shrink-0 text-xs text-slate-500 transition-transform group-open:rotate-180"
                      aria-hidden
                    >
                      ▼
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      <span className="truncate font-medium text-slate-900">
                        {session.groupTitle}
                      </span>
                      <span className="shrink-0 text-slate-500">（{total}門）</span>
                      <span className="shrink-0 font-medium tabular-nums text-slate-700">
                        {correct}/{total}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-600">
                      {formatJaDate(session.sessionAt)}
                      {showUser ? (
                        <span className="ml-2 text-slate-500">
                          · {displayForUser(session.userId)}
                        </span>
                      ) : null}
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 px-2 pb-3 pt-1">
                    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                          <th className="py-2 pr-3">小問</th>
                          <th className="py-2 pr-3">結果</th>
                          <th className="py-2">記述解答</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.attempts.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 text-slate-800">{row.problemTitle}</td>
                            <td className="py-2 pr-3">{attemptResultMark(row)}</td>
                            <td className="py-2 text-slate-800">
                              {row.problemType === "text" ? (
                                <span className="whitespace-pre-wrap">
                                  {formatTextAnswer(row.answerText)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
