"use client"

import { useParams } from "next/navigation"
import { UserFormPage } from "@/components/features/users/user-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="user" action="update">
      <UserFormPage mode="edit" userId={id} />
    </PermissionGuard>
  )
}
