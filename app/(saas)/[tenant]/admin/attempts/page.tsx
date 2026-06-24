import Link from "next/link"

import AttemptHistorySection, { type HistoryListEntry } from "./AttemptHistoryList"
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
  problemPrompt: string | null
  answerText: string | null
  selectedOptionIds: string[]
  userAnswerDisplay: string
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

function buildUserAnswerDisplay(
  problemType: AttemptRow["problemType"],
  answerText: string | null,
  selectedOptionIds: string[],
  optionLabelById: Map<string, string>
): string {
  if (problemType === "text") {
    return formatTextAnswer(answerText)
  }
  if (selectedOptionIds.length === 0) {
    return "（未選択）"
  }
  const labels = selectedOptionIds
    .map((id) => optionLabelById.get(id))
    .filter((label): label is string => Boolean(label))
  return labels.length > 0 ? labels.join("・") : "（不明）"
}


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
  problemPrompt: string | null
} {
  const row = firstRelationRow<{
    title?: unknown
    type?: unknown
    position?: unknown
    prompt?: unknown
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
      problemPrompt: null,
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

  const problemPrompt = typeof row.prompt === "string" ? row.prompt : null

  const gid =
    typeof row.problem_group_id === "string" && row.problem_group_id.length > 0
      ? row.problem_group_id
      : null

  const gRow = firstRelationRow<{ title?: unknown }>(row.problem_groups)
  const problemGroupTitle =
    gRow && typeof gRow.title === "string" && gRow.title.length > 0 ? gRow.title : null

  return {
    problemTitle,
    problemType,
    problemPosition,
    problemGroupId: gid,
    problemGroupTitle,
    problemPrompt,
  }
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

function toHistoryListEntries(
  items: HistoryListItem[],
  displayForUser: (uid: string) => string,
  filterUserId: string,
  formatJaDateFn: (iso: string) => string
): HistoryListEntry[] {
  return items.map((item) => {
    if (item.kind === "standalone") {
      const row = item.attempt
      return {
        key: item.key,
        kind: "standalone",
        attemptIds: [row.id],
        deleteLabel: row.problemTitle,
        standaloneDate: formatJaDateFn(row.created_at),
        userLabel: !filterUserId ? displayForUser(row.user_id) : undefined,
        subQuestions: [
          {
            id: row.id,
            title: row.problemTitle,
            problemPrompt: row.problemPrompt,
            userAnswerDisplay: row.userAnswerDisplay,
            isCorrect: row.is_correct,
          },
        ],
      }
    }

    const { session } = item
    const { correct, total } = sessionScore(session.attempts)
    return {
      key: item.key,
      kind: "group_session",
      attemptIds: session.attempts.map((a) => a.id),
      deleteLabel: session.groupTitle,
      groupTitle: session.groupTitle,
      sessionDate: formatJaDateFn(session.sessionAt),
      userLabel: !filterUserId ? displayForUser(session.userId) : undefined,
      scoreCorrect: correct,
      scoreTotal: total,
      subQuestions: session.attempts.map((row) => ({
        id: row.id,
        title: row.problemTitle,
        problemPrompt: row.problemPrompt,
        userAnswerDisplay: row.userAnswerDisplay,
        isCorrect: row.is_correct,
      })),
    }
  })
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
      "id, created_at, is_correct, user_id, problem_id, answer_text, selected_option_ids, problems(title, type, position, prompt, problem_group_id, problem_groups(title))"
    )
    .eq("organization_id", organization.id)
    .gte("created_at", sixMonthsAgoIso())
    .order("created_at", { ascending: false })
    .limit(2500)

  if (filterUserId) {
    attemptsQuery = attemptsQuery.eq("user_id", filterUserId)
  }

  const { data: attemptsRaw } = await attemptsQuery

  const attemptsBase: Omit<AttemptRow, "userAnswerDisplay">[] = (attemptsRaw ?? []).map((row) => {
    const r = row as {
      id: string
      created_at: string
      is_correct: boolean | null
      user_id: string
      problem_id: string
      answer_text: string | null
      selected_option_ids: string[] | null
      problems: unknown
    }
    const parsed = parseProblemsJoin(r.problems)
    const selectedOptionIds = Array.isArray(r.selected_option_ids)
      ? r.selected_option_ids.filter((id): id is string => typeof id === "string")
      : []
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
      problemPrompt: parsed.problemPrompt,
      answerText: r.answer_text,
      selectedOptionIds,
    }
  })

  const allOptionIds = Array.from(
    new Set(attemptsBase.flatMap((a) => a.selectedOptionIds))
  )
  const optionLabelById = new Map<string, string>()
  if (allOptionIds.length > 0) {
    const { data: optionsRaw } = await supabase
      .from("problem_options")
      .select("id, label")
      .in("id", allOptionIds)
    for (const opt of optionsRaw ?? []) {
      const o = opt as { id: string; label: string }
      if (o.id && o.label) {
        optionLabelById.set(o.id, o.label)
      }
    }
  }

  const attempts: AttemptRow[] = attemptsBase.map((a) => ({
    ...a,
    userAnswerDisplay: buildUserAnswerDisplay(
      a.problemType,
      a.answerText,
      a.selectedOptionIds,
      optionLabelById
    ),
  }))

  const displayForUser = (uid: string) => {
    const p = profileByUserId.get(uid)
    if (p?.display_name?.trim()) return `${p.display_name} (${p.login_id})`
    if (p) return p.login_id
    return uid.slice(0, 8) + "…"
  }

  const historyItems = buildHistoryList(attempts)
  const historyEntries = toHistoryListEntries(
    historyItems,
    displayForUser,
    filterUserId,
    formatJaDate
  )
  const groupSessionCount = historyItems.filter((i) => i.kind === "group_session").length

  const graded = attempts.filter((a) => a.is_correct !== null && a.is_correct !== undefined)
  const correctCount = graded.filter((a) => a.is_correct === true).length
  const gradedCount = graded.length
  const ratePercent =
    gradedCount === 0 ? null : Math.round((correctCount / gradedCount) * 1000) / 10

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>解答履歴</CardTitle>
          <CardDescription>
            {organization.name} の受講者の解答を確認できます。直近6ヶ月分のみ表示します（それ以前は定期的な削除の対象です）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-cream-800">
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
          <div className="rounded-md border border-cream-300 bg-cream-200 px-4 py-3">
            <p className="text-xs font-semibold text-cream-700">小問の送信回数</p>
            <p className="mt-1 text-2xl font-semibold text-cream-900">{attempts.length}</p>
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

      <Card>
        <CardHeader>
          <CardTitle>受講者で絞り込み</CardTitle>
          <CardDescription>GET フォームで URL が変わります。ブックマークしやすい形です。</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1">
              <label htmlFor="userId" className="text-xs font-medium text-cream-800">
                受講者
              </label>
              <select
                id="userId"
                name="userId"
                defaultValue={filterUserId}
                className="w-full rounded-md border border-cream-300 bg-white px-3 py-2 text-sm"
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

      <AttemptHistorySection tenant={params.tenant} entries={historyEntries} />
    </div>
  )
}
