"use client"

import { BookingsReportPage } from "@/components/features/reports/pages/bookings-report-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function Page() {
  return (
    <PermissionGuard module="report" action="read">
      <BookingsReportPage />
    </PermissionGuard>
  )
}
