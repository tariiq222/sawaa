"use client"

import { useParams } from "next/navigation"
import { ProgramDetailPage } from "@/components/features/programs/program-detail-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function ProgramDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="booking" action="read">
      <ProgramDetailPage id={id ?? ""} />
    </PermissionGuard>
  )
}
