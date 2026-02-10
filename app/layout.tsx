import "./globals.css"
import type { ReactNode } from "react"

export const metadata = {
  title: "Learning Platform MVP",
  description: "Multi-tenant learning platform",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}

