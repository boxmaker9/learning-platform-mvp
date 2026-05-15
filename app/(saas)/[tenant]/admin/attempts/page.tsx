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
  problemGroupId: string | null
  problemGroupTitle: string | null
}

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
  problemGroupId: string | null
  problemGroupTitle: string | null
} {
  const row = firstRelationRow<{
    title?: unknown
    problem_group_id?: unknown
    problem_groups?: unknown
  }>(problems)

  if (!row) {
    return {
      problemTitle: "（タイトル不明）",
      problemGroupId: null,
      problemGroupTitle: null,
    }
  }

  const problemTitle =
    typeof row.title === "string" && row.title.length > 0 ? row.title : "（タイトル不明）"

  const gid =
    typeof row.problem_group_id === "string" && row.problem_group_id.length > 0
      ? row.problem_group_id
      : null

  const gRow = firstRelationRow<{ title?: unknown }>(row.problem_groups)
  const problemGroupTitle =
    gRow && typeof gRow.title === "string" && gRow.title.length > 0 ? gRow.title : null

  return { problemTitle, problemGroupId: gid, problemGroupTitle }
}

const NO_GROUP_KEY = "__no_problem_group__"

type AttemptGroupSection = {
  key: string
  groupId: string | null
  heading: string
  attempts: AttemptRow[]
  latestIso: string
}

function buildAttemptGroups(attempts: AttemptRow[]): AttemptGroupSection[] {
  const map = new Map<string, AttemptGroupSection>()

  for (const a of attempts) {
    const key = a.problemGroupId ?? NO_GROUP_KEY
    let heading: string
    if (!a.problemGroupId) {
      heading = "大問に属さない小問"
    } else if (a.problemGroupTitle) {
      heading = a.problemGroupTitle
    } else {
      heading = "（大問情報の取得に失敗／削除済みの可能性）"
    }

    const existing = map.get(key)
    if (existing) {
      existing.attempts.push(a)
      if (a.created_at > existing.latestIso) existing.latestIso = a.created_at
    } else {
      map.set(key, {
        key,
        groupId: a.problemGroupId,
        heading,
        attempts: [a],
        latestIso: a.created_at,
      })
    }
  }

  const list = Array.from(map.values())
  for (const g of list) {
    g.attempts.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  list.sort((a, b) => {
    if (a.key === NO_GROUP_KEY) return 1
    if (b.key === NO_GROUP_KEY) return -1
    return b.latestIso.localeCompare(a.latestIso)
  })

  return list
}
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
      "id, created_at, is_correct, user_id, problem_id, problems(title, problem_group_id, problem_groups(title))"
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
      problemGroupId: parsed.problemGroupId,
      problemGroupTitle: parsed.problemGroupTitle,
    }
  })

  const attemptGroups = buildAttemptGroups(attempts)

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
            記述式の問題は自動採点していないため、一覧の「結果」が「—」になることがあります。択一・複数選択は送信時の正誤が記録されます。
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
            <p className="text-xs font-semibold text-slate-500">解答回数（全形式）</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{attempts.length}</p>
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
            大問ごとに折りたたみできます。行をクリック（またはタップ）すると、その大問に含まれる小問の解答一覧が表示されます。日時は日本時間（Asia/Tokyo）です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 overflow-x-auto">
          {attempts.length === 0 ? (
            <p className="text-sm text-slate-500">該当する解答履歴がありません。</p>
          ) : (
            attemptGroups.map((section) => (
              <details
                key={section.key}
                className="rounded-md border border-slate-200 bg-white open:shadow-sm"
              >
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
                  <span className="inline-flex w-full items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate">
                      {section.heading}
                      <span className="ml-2 font-normal text-slate-500">
                        （{section.attempts.length} 件）
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">展開</span>
                  </span>
                </summary>
                <div className="border-t border-slate-100 px-2 pb-3 pt-1">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="py-2 pr-3">日時</th>
                        <th className="py-2 pr-3">受講者</th>
                        <th className="py-2 pr-3">小問</th>
                        <th className="py-2">結果</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.attempts.map((row) => {
                        const title = row.problemTitle
                        const mark =
                          row.is_correct === true ? (
                            <span className="font-medium text-emerald-700">正解</span>
                          ) : row.is_correct === false ? (
                            <span className="font-medium text-red-700">不正解</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )
                        return (
                          <tr key={row.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                              {formatJaDate(row.created_at)}
                            </td>
                            <td className="py-2 pr-3 text-slate-800">
                              {displayForUser(row.user_id)}
                            </td>
                            <td className="py-2 pr-3 text-slate-800">{title}</td>
                            <td className="py-2">{mark}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
