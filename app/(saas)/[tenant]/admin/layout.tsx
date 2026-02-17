import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

import LogoutButton from "./LogoutButton"

const navItems = [
  { label: "問題一覧", href: "problems" },
  { label: "問題作成", href: "problems/new" },
  { label: "招待管理", href: "invitations" },
]

export default function AdminLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { tenant: string }
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Admin</p>
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
              <Link href={`/${params.tenant}/admin/${item.href}`}>
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
  )
}

