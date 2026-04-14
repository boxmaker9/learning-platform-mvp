"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export default function DeleteGroupButton({
  tenant,
  groupId,
}: {
  tenant: string
  groupId: string
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const onClick = async () => {
    const ok = window.confirm(
      "この大問を削除します。中の小問もすべて削除されます。よろしいですか？"
    )
    if (!ok) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tenants/${tenant}/groups/${groupId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string; detail?: string }
        throw new Error(payload.detail ?? payload.message ?? "削除に失敗しました。")
      }

      window.location.reload()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "削除に失敗しました。")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="text-red-600 hover:text-red-700"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void onClick()
      }}
      disabled={isDeleting}
      aria-disabled={isDeleting}
    >
      {isDeleting ? "削除中..." : "削除"}
    </Button>
  )
}

