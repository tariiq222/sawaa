"use client"

import { RatingsReportPage } from "@/components/features/reports/pages/ratings-report-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function Page() {
  return (
    <PermissionGuard module="report" action="read">
      <RatingsReportPage />
    </PermissionGuard>
  )
}
