"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Label } from "@/components/ui/label"

export default function TagFilter({
  tenant,
  tags,
  selectedTag,
  queryKey = "tag",
  label = "タグで絞り込み",
  htmlId = "tagFilter",
}: {
  tenant: string
  tags: string[]
  selectedTag: string
  queryKey?: string
  label?: string
  htmlId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const options = useMemo(() => {
    return ["", ...tags]
  }, [tags])

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    const trimmed = value.trim()
    if (trimmed) {
      params.set(queryKey, trimmed)
    } else {
      params.delete(queryKey)
    }

    const qs = params.toString()
    router.push(qs.length > 0 ? `${pathname}?${qs}` : pathname)
  }

  if (!tenant) return null

  return (
    <div className="mb-4 space-y-2">
      <Label htmlFor={htmlId}>{label}</Label>
      <select
        id={htmlId}
        className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
        value={selectedTag}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        <option value="">すべて</option>
        {options
          .filter((t) => t !== "")
          .map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
      </select>
    </div>
  )
}

