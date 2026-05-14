"use client"

import { useParams } from "next/navigation"
import { UserFormPage } from "@/components/features/users/user-form-page"

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>()
  return <UserFormPage mode="edit" userId={id} />
}
