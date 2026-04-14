"use client"

import { useParams } from "next/navigation"

import GroupProblemForm from "../../../GroupProblemForm"

export default function GroupProblemCreatePage() {
  const params = useParams()
  const tenant =
    typeof params.tenant === "string"
      ? params.tenant
      : Array.isArray(params.tenant)
        ? params.tenant[0]
        : ""
  const groupId =
    typeof params.groupId === "string"
      ? params.groupId
      : Array.isArray(params.groupId)
        ? params.groupId[0]
        : ""

  return <GroupProblemForm tenant={tenant} groupId={groupId} />
}

