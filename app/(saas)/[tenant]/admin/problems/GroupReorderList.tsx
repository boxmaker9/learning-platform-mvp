"use client"

import Link from "next/link"

import ReorderableList from "@/components/admin/ReorderableList"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import DeleteGroupButton from "./DeleteGroupButton"

type GroupItem = {
  id: string
  title: string
  created_at: string | null
  problemCount: number
  tags?: string[]
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("ja-JP")
}

export default function GroupReorderList({
  tenant,
  groups,
  reorderDisabled = false,
  showEditLink = false,
}: {
  tenant: string
  groups: GroupItem[]
  reorderDisabled?: boolean
  showEditLink?: boolean
}) {
  return (
    <ReorderableList
      tenant={tenant}
      reorderPath="/groups/reorder"
      initialItems={groups}
      disabled={reorderDisabled}
      renderItem={(group, index, controls) => (
        <div className="flex gap-3">
          {controls}
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-cream-300 bg-white p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link
                  className="block truncate font-medium hover:underline"
                  href={`/${tenant}/admin/groups/${group.id}`}
                >
                  {index + 1}. {group.title}
                </Link>
                {group.tags && group.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.tags.slice(0, 6).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-cream-700">全{group.problemCount}問</span>
                {showEditLink ? null : <DeleteGroupButton tenant={tenant} groupId={group.id} />}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-cream-700">
              <span>作成日: {formatDate(group.created_at)}</span>
              <div className="flex items-center gap-2">
                {showEditLink ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/${tenant}/admin/groups/${group.id}/edit`}>編集</Link>
                  </Button>
                ) : null}
                <Link
                  className="font-medium text-primary-600 hover:underline"
                  href={`/${tenant}/admin/groups/${group.id}/problems/new`}
                >
                  小問を追加
                </Link>
                {!showEditLink ? null : (
                  <DeleteGroupButton tenant={tenant} groupId={group.id} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    />
  )
}
