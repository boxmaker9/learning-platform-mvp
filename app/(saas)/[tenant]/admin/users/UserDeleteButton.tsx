"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"

type UserDeleteButtonProps = {
  tenant: string
  userId: string
  label: string
  disabled?: boolean
  disabledReason?: string
}

export default function UserDeleteButton({
  tenant,
  userId,
  label,
  disabled = false,
  disabledReason,
}: UserDeleteButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const onClick = async () => {
    if (disabled) return

    const ok = window.confirm(`${label} を削除してもよろしいですか？`)
    if (!ok) return

    const okAgain = window.confirm(
      "本当に削除しますか？解答履歴も含め、取り消すことはできません。"
    )
    if (!okAgain) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tenants/${tenant}/users/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string; detail?: string }
        throw new Error(payload.detail ?? payload.message ?? "削除に失敗しました。")
      }

      router.refresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "削除に失敗しました。")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      type="button"
      className="inline-flex rounded p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      onClick={() => void onClick()}
      disabled={disabled || isDeleting}
      aria-label={disabled ? disabledReason ?? "削除できません" : `${label} を削除`}
      title={disabled ? disabledReason : `${label} を削除`}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
