"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export default function LogoutButton() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogout = async () => {
    setIsSubmitting(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      window.location.href = "/login"
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start"
      onClick={handleLogout}
      disabled={isSubmitting}
    >
      {isSubmitting ? "ログアウト中..." : "ログアウト"}
    </Button>
  )
}

