import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-100 text-cream-900">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        {children}
      </main>
    </div>
  )
}

