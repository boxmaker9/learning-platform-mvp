"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

export default function UserPasswordField({ password }: { password: string | null }) {
  const [visible, setVisible] = useState(false)
  const hasPassword = Boolean(password && password.length > 0)
  const display = hasPassword ? password! : "（未保存）"

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm text-cream-900">
        {hasPassword ? (visible ? display : "••••••••") : display}
      </span>
      {hasPassword ? (
        <button
          type="button"
          className="rounded p-1 text-cream-700 hover:bg-cream-200 hover:text-cream-900"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  )
}
