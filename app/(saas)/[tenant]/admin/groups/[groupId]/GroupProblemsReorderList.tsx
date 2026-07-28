"use client"

import Link from "next/link"

import ReorderableList from "@/components/admin/ReorderableList"
import { Badge } from "@/components/ui/badge"

const typeLabels: Record<string, string> = {
  single_choice: "択一式",
  multiple_choice: "複数選択",
  text: "記述式",
}

type ProblemItem = {
  id: string
  title: string
  type: string
  created_at: string | null
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("ja-JP")
}

export default function GroupProblemsReorderList({
  tenant,
  groupId,
  problems,
}: {
  tenant: string
  groupId: string
  problems: ProblemItem[]
}) {
  return (
    <ReorderableList
      tenant={tenant}
      reorderPath={`/groups/${groupId}/problems/reorder`}
      initialItems={problems}
      renderItem={(problem, index, controls) => (
        <div className="flex gap-3">
          {controls}
          <Link
            href={`/${tenant}/admin/problems/${problem.id}`}
            className="flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-cream-300 bg-white p-4 text-sm transition hover:border-primary-200"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="min-w-0 truncate font-medium">
                {index + 1}. {problem.title}
              </p>
              <Badge variant="secondary">{typeLabels[problem.type] ?? problem.type}</Badge>
            </div>
            <div className="text-xs text-cream-700">作成日: {formatDate(problem.created_at)}</div>
          </Link>
        </div>
      )}
    />
  )
}
