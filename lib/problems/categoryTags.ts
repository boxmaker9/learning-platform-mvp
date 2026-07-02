export function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

export function effectiveCategoryTags(problemTags: string[], groupTags: string[]): string[] {
  if (problemTags.length > 0) return problemTags
  return groupTags
}
