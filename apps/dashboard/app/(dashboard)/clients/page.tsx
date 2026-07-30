"use client"

import { ClientListPage } from "@/components/features/clients/client-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function ClientsRoute() {
  return (
    <PermissionGuard module="client" action="read">
      <ClientListPage />
    </PermissionGuard>
  )
}
