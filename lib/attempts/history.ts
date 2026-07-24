import type { SupabaseClient } from "@supabase/supabase-js"

export type HistorySubQuestion = {
  id: string
  title: string
  problemPrompt: string | null
  categoryTags: string[]
  userAnswerDisplay: string
  modelAnswerDisplay: string
  explanation: string | null
  isCorrect: boolean | null
}

export type HistoryListEntry = {
  key: string
  kind: "standalone" | "group_session"
  attemptIds: string[]
  deleteLabel: string
  subQuestions: HistorySubQuestion[]
  groupTitle?: string
  sessionDate?: string
  userLabel?: string
  scoreCorrect?: number
  scoreTotal?: number
  standaloneDate?: string
}

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
  categoryTags: string[]
  answerText: string | null
  selectedOptionIds: string[]
  userAnswerDisplay: string
  modelAnswerDisplay: string
  explanation: string | null
}

type AttemptBaseRow = Omit<AttemptRow, "userAnswerDisplay" | "modelAnswerDisplay"> & {
  problemAnswerText: string | null
}

type CategoryCorrectRate = {
  tag: string
  correctCount: number
  gradedCount: number
  correctRatePercent: number
}

type GroupAttemptSession = {
  key: string
  userId: string
  groupId: string
  groupTitle: string
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

export type LoadedAttemptHistory = {
  historyEntries: HistoryListEntry[]
  groupSessionCount: number
  attemptCount: number
  gradedCount: number
  correctCount: number
  ratePercent: number | null
  topCategoryLowCorrectRates: CategoryCorrectRate[]
}

function sixMonthsAgoIso() {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d.toISOString()
}

export function formatAttemptJaDate(iso: string) {
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

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function effectiveCategoryTags(problemTags: string[], groupTags: string[]): string[] {
  if (problemTags.length > 0) return problemTags
  return groupTags
}

function computeTopCategoryLowCorrectRates(
  attempts: AttemptRow[],
  limit = 3
): CategoryCorrectRate[] {
  const statsByTag = new Map<string, { correct: number; graded: number }>()

  for (const attempt of attempts) {
    if (attempt.is_correct === null || attempt.is_correct === undefined) continue
    if (attempt.categoryTags.length === 0) continue

    for (const tag of attempt.categoryTags) {
      const current = statsByTag.get(tag) ?? { correct: 0, graded: 0 }
      current.graded += 1
      if (attempt.is_correct === true) {
        current.correct += 1
      }
      statsByTag.set(tag, current)
    }
  }

  return Array.from(statsByTag.entries())
    .map(([tag, { correct, graded }]) => ({
      tag,
      correctCount: correct,
      gradedCount: graded,
      correctRatePercent: Math.round((correct / graded) * 1000) / 10,
    }))
    .sort((a, b) => {
      if (a.correctRatePercent !== b.correctRatePercent) {
        return a.correctRatePercent - b.correctRatePercent
      }
      if (b.gradedCount !== a.gradedCount) {
        return b.gradedCount - a.gradedCount
      }
      return a.tag.localeCompare(b.tag, "ja")
    })
    .slice(0, limit)
}

function modelAnswerDisplayForProblem(
  type: AttemptRow["problemType"],
  problemAnswerText: string | null,
  correctOptionLabels: string[]
): string {
  if (type === "text") {
    const t = problemAnswerText?.trim() ?? ""
    return t.length > 0 ? t : "（模範解答が未設定です）"
  }
  if (correctOptionLabels.length === 0) return "（正解の選択肢が未設定です）"
  return correctOptionLabels.join("・")
}

function parseProblemsJoin(problems: unknown): {
  problemTitle: string
  problemType: AttemptRow["problemType"]
  problemPosition: number
  problemGroupId: string | null
  problemGroupTitle: string | null
  problemPrompt: string | null
  categoryTags: string[]
  problemAnswerText: string | null
  explanation: string | null
} {
  const row = firstRelationRow<{
    title?: unknown
    type?: unknown
    position?: unknown
    prompt?: unknown
    tags?: unknown
    answer_text?: unknown
    explanation?: unknown
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
      categoryTags: [],
      problemAnswerText: null,
      explanation: null,
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
  const problemAnswerText = typeof row.answer_text === "string" ? row.answer_text : null
  const explanation = typeof row.explanation === "string" ? row.explanation : null

  const gid =
    typeof row.problem_group_id === "string" && row.problem_group_id.length > 0
      ? row.problem_group_id
      : null

  const gRow = firstRelationRow<{ title?: unknown; tags?: unknown }>(row.problem_groups)
  const problemGroupTitle =
    gRow && typeof gRow.title === "string" && gRow.title.length > 0 ? gRow.title : null
  const categoryTags = effectiveCategoryTags(
    parseStringArray(row.tags),
    gRow ? parseStringArray(gRow.tags) : []
  )

  return {
    problemTitle,
    problemType,
    problemPosition,
    problemGroupId: gid,
    problemGroupTitle,
    problemPrompt,
    categoryTags,
    problemAnswerText,
    explanation,
  }
}

function subQuestionFromAttempt(row: AttemptRow): HistorySubQuestion {
  return {
    id: row.id,
    title: row.problemTitle,
    problemPrompt: row.problemPrompt,
    categoryTags: row.categoryTags,
    userAnswerDisplay: row.userAnswerDisplay,
    modelAnswerDisplay: row.modelAnswerDisplay,
    explanation: row.explanation,
    isCorrect: row.is_correct,
  }
}

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
  hideUserLabels: boolean,
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
        userLabel: hideUserLabels ? undefined : displayForUser(row.user_id),
        subQuestions: [subQuestionFromAttempt(row)],
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
      userLabel: hideUserLabels ? undefined : displayForUser(session.userId),
      scoreCorrect: correct,
      scoreTotal: total,
      subQuestions: session.attempts.map((row) => subQuestionFromAttempt(row)),
    }
  })
}

export async function loadAttemptHistory(
  supabase: SupabaseClient,
  organizationId: string,
  options: {
    filterUserId?: string
    displayForUser?: (userId: string) => string
    hideUserLabels?: boolean
    includeCategoryTop3?: boolean
  } = {}
): Promise<LoadedAttemptHistory> {
  let attemptsQuery = supabase
    .from("problem_attempts")
    .select(
      "id, created_at, is_correct, user_id, problem_id, answer_text, selected_option_ids, problems(title, type, position, prompt, tags, answer_text, explanation, problem_group_id, problem_groups(title, tags))"
    )
    .eq("organization_id", organizationId)
    .gte("created_at", sixMonthsAgoIso())
    .order("created_at", { ascending: false })
    .limit(2500)

  if (options.filterUserId) {
    attemptsQuery = attemptsQuery.eq("user_id", options.filterUserId)
  }

  const { data: attemptsRaw } = await attemptsQuery

  const attemptsBase: AttemptBaseRow[] = (attemptsRaw ?? []).map((row) => {
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
      categoryTags: parsed.categoryTags,
      answerText: r.answer_text,
      selectedOptionIds,
      explanation: parsed.explanation,
      problemAnswerText: parsed.problemAnswerText,
    }
  })

  const allProblemIds = Array.from(new Set(attemptsBase.map((a) => a.problem_id)))
  const correctLabelsByProblemId = new Map<string, string[]>()
  if (allProblemIds.length > 0) {
    const { data: allOptionsRaw } = await supabase
      .from("problem_options")
      .select("problem_id, label, is_correct, position")
      .eq("organization_id", organizationId)
      .in("problem_id", allProblemIds)
      .order("position", { ascending: true })
    for (const opt of allOptionsRaw ?? []) {
      const o = opt as {
        problem_id: string
        label: string
        is_correct: boolean
      }
      if (!o.is_correct || !o.label) continue
      const list = correctLabelsByProblemId.get(o.problem_id) ?? []
      list.push(o.label)
      correctLabelsByProblemId.set(o.problem_id, list)
    }
  }

  const allOptionIds = Array.from(new Set(attemptsBase.flatMap((a) => a.selectedOptionIds)))
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
    modelAnswerDisplay: modelAnswerDisplayForProblem(
      a.problemType,
      a.problemAnswerText,
      correctLabelsByProblemId.get(a.problem_id) ?? []
    ),
  }))

  const displayForUser = options.displayForUser ?? ((uid: string) => uid.slice(0, 8) + "…")
  const hideUserLabels = options.hideUserLabels ?? Boolean(options.filterUserId)

  const historyItems = buildHistoryList(attempts)
  const historyEntries = toHistoryListEntries(
    historyItems,
    displayForUser,
    hideUserLabels,
    formatAttemptJaDate
  )
  const groupSessionCount = historyItems.filter((i) => i.kind === "group_session").length

  const graded = attempts.filter((a) => a.is_correct !== null && a.is_correct !== undefined)
  const correctCount = graded.filter((a) => a.is_correct === true).length
  const gradedCount = graded.length
  const ratePercent =
    gradedCount === 0 ? null : Math.round((correctCount / gradedCount) * 1000) / 10

  const topCategoryLowCorrectRates =
    options.includeCategoryTop3 && options.filterUserId
      ? computeTopCategoryLowCorrectRates(attempts, 3)
      : []

  return {
    historyEntries,
    groupSessionCount,
    attemptCount: attempts.length,
    gradedCount,
    correctCount,
    ratePercent,
    topCategoryLowCorrectRates,
  }
}
