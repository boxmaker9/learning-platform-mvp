"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export default function AcceptInviteButton({ inviteId }: { inviteId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onAccept = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message ?? "招待の受諾に失敗しました。")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラーが発生しました。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={onAccept} disabled={isSubmitting || success}>
        {success ? "受諾済み" : isSubmitting ? "処理中..." : "招待を受諾"}
      </Button>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

