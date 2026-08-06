"use client"

import { FinancialReportPage } from "@/components/features/reports/pages/financial-report-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function Page() {
  return (
    <PermissionGuard module="report" action="read">
      <FinancialReportPage />
    </PermissionGuard>
  )
}
