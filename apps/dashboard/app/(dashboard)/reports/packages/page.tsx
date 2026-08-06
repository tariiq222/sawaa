"use client"

import { PackagesReportPage } from "@/components/features/reports/pages/packages-report-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function Page() {
  return (
    <PermissionGuard module="report" action="read">
      <PackagesReportPage />
    </PermissionGuard>
  )
}
