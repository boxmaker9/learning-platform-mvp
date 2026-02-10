export function resolveTenantFromHost(hostname: string, rootDomain: string | null) {
  if (!rootDomain) return null
  if (hostname === rootDomain) return null
  if (!hostname.endsWith(rootDomain)) return null

  const subdomain = hostname.replace(`.${rootDomain}`, "")
  return subdomain.length > 0 ? subdomain : null
}

export function normalizeTenantSlug(value: string) {
  return value.trim().toLowerCase()
}

