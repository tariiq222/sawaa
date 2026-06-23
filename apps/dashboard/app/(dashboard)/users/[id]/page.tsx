"use client"

import { useParams } from "next/navigation"
import { UserDetailPage } from "@/components/features/users/user-detail-page"

export default function UserDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return <UserDetailPage userId={id} />
}