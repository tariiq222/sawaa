"use client"

import { OverviewReportPage } from "@/components/features/reports/pages/overview-report-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function Page() {
  return (
    <PermissionGuard module="report" action="read">
      <OverviewReportPage />
    </PermissionGuard>
  )
}
