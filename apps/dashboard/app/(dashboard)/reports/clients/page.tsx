"use client"

import { ClientsReportPage } from "@/components/features/reports/pages/clients-report-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function Page() {
  return (
    <PermissionGuard module="report" action="read">
      <ClientsReportPage />
    </PermissionGuard>
  )
}
