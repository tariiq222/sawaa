"use client"

import { PractitionersReportPage } from "@/components/features/reports/pages/practitioners-report-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function Page() {
  return (
    <PermissionGuard module="report" action="read">
      <PractitionersReportPage />
    </PermissionGuard>
  )
}
