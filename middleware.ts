import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { normalizeTenantSlug, resolveTenantFromHost } from "@/lib/tenant"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 })
      },
    },
  })

  await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const hostname = request.headers.get("host")?.split(":")[0] ?? ""
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? process.env.ROOT_DOMAIN ?? null

  const pathSegments = url.pathname.split("/").filter(Boolean)
  const reservedPaths = new Set([
    "api",
    "login",
    "signup",
    "tenants",
  ])
  const pathTenant =
    pathSegments[0] && !reservedPaths.has(pathSegments[0]) ? pathSegments[0] : null
  const hostTenant = resolveTenantFromHost(hostname, rootDomain)

  let tenant = pathTenant ?? hostTenant
  if (!tenant) {
    return response
  }

  tenant = normalizeTenantSlug(tenant)
  response.headers.set("x-tenant", tenant)

  if (hostTenant && !pathTenant) {
    url.pathname = `/${tenant}${url.pathname}`
    const rewriteResponse = NextResponse.rewrite(url)
    response.cookies.getAll().forEach((cookie) => {
      rewriteResponse.cookies.set(cookie)
    })
    rewriteResponse.headers.set("x-tenant", tenant)
    return rewriteResponse
  }

  return response
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
}

