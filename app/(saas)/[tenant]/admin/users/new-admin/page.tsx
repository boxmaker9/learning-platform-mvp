"use client"

import { useParams } from "next/navigation"

import UserCreateForm from "../UserCreateForm"

export default function AdminAdminCreatePage() {
  const params = useParams()
  const tenant =
    typeof params.tenant === "string"
      ? params.tenant
      : Array.isArray(params.tenant)
        ? params.tenant[0]
        : ""

  return (
    <UserCreateForm
      tenant={tenant}
      role="admin"
      title="管理者作成"
      description="テナント内でユニークなログインIDとパスワードで管理者を作成します。作成後はログイン画面から同じテナント・ログインIDで管理画面に入れます。"
    />
  )
}
