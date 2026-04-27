import { NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

import { normalizeTenantSlug, resolveTenantFromHost } from "@/lib/tenant"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const url = request.nextUrl.clone()
  const pathSegments = url.pathname.split("/").filter(Boolean)
  const reservedPaths = new Set(["api", "login", "signup", "tenants"])
  const firstSegment = pathSegments[0]
  const isReservedPath = Boolean(firstSegment && reservedPaths.has(firstSegment))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  // Edge middleware has a tight timeout; avoid calling Supabase on public/reserved routes.
  // (Refreshing session cookies for these routes isn't needed and can cause 504 timeouts.)
  if (!isReservedPath) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options?: CookieOptions) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options?: CookieOptions) {
            response.cookies.set({ name, value: "", ...options, maxAge: 0 })
          },
        },
      })

      await supabase.auth.getUser()
    } catch {
      // If Supabase is slow/unreachable, don't block the entire site in middleware.
    }
  }

  const hostname = request.headers.get("host")?.split(":")[0] ?? ""
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? process.env.ROOT_DOMAIN ?? null

  const pathTenant = firstSegment && !isReservedPath ? firstSegment : null
  const hostTenant = resolveTenantFromHost(hostname, rootDomain)

  let tenant = pathTenant ?? hostTenant
  if (!tenant) {
    return response
  }

  tenant = normalizeTenantSlug(tenant)
  response.headers.set("x-tenant", tenant)

  if (hostTenant && !pathTenant && !isReservedPath) {
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

