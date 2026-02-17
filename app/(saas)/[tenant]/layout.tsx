import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

import LogoutButton from "./admin/LogoutButton"

const navItems = [
  { label: "問題一覧", href: "admin/problems" },
  { label: "問題作成", href: "admin/problems/new" },
  { label: "招待管理", href: "admin/invitations" },
]

export default function TenantLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { tenant: string }
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Tenant
            </p>
            <p className="text-lg font-semibold">{params.tenant}</p>
          </div>
          <nav className="text-sm text-slate-500">
            <span>Learning Platform MVP</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 border-b border-slate-200 pb-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Tenant
              </p>
              <p className="text-sm font-semibold">{params.tenant}</p>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <Link href={`/${params.tenant}/${item.href}`}>
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>
            <div className="my-4 border-t border-slate-200" />
            <nav className="space-y-2">
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link href={`/${params.tenant}`}>受講者トップ</Link>
              </Button>
              <LogoutButton />
            </nav>
          </aside>

          <section>{children}</section>
        </div>
      </main>
    </div>
  )
}

