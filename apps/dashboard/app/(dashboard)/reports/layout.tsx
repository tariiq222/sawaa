"use client"

import { ReactNode } from "react"
import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PermissionGuard } from "@/components/features/permission-guard"
import { ReportsSidebar } from "@/components/features/reports/reports-sidebar"
import { ReportsPeriodProvider } from "@/components/features/reports/reports-period-context"

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGuard module="report" action="read">
      <ReportsPeriodProvider>
        <ListPageShell>
          <Breadcrumbs />
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <ReportsSidebar />
            <div className="min-w-0">{children}</div>
          </div>
        </ListPageShell>
      </ReportsPeriodProvider>
    </PermissionGuard>
  )
}
