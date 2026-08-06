"use client"

import { ServicesReportPage } from "@/components/features/reports/pages/services-report-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function Page() {
  return (
    <PermissionGuard module="report" action="read">
      <ServicesReportPage />
    </PermissionGuard>
  )
}
