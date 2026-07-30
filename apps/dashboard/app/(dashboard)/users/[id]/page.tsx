"use client"

import { useParams } from "next/navigation"
import { UserDetailPage } from "@/components/features/users/user-detail-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function UserDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="user" action="read">
      <UserDetailPage userId={id} />
    </PermissionGuard>
  )
}