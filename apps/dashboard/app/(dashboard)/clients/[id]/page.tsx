"use client"

import { useParams } from "next/navigation"
import { ClientDetailPage } from "@/components/features/clients/client-detail-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function ClientDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="client" action="read">
      <ClientDetailPage clientId={id} />
    </PermissionGuard>
  )
}
