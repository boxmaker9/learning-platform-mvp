const LOGIN_ID_DOMAIN = "login.local"

export function normalizeTenantSlug(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeLoginId(value: string) {
  return value.trim().toLowerCase()
}

export function isValidLoginId(value: string) {
  // allow: a-z 0-9 and - _
  return /^[a-z0-9][a-z0-9_-]{2,31}$/.test(value)
}

export function authEmailFromLoginId(tenant: string, loginId: string) {
  const t = normalizeTenantSlug(tenant)
  const id = normalizeLoginId(loginId)
  // deterministic, unique by (tenant, loginId)
  return `${id}.${t}@${LOGIN_ID_DOMAIN}`
}

