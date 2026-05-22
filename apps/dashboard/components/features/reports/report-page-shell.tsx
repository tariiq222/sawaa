"use client"

import { ReactNode } from "react"
import { PageHeader } from "@/components/features/page-header"
import { ReportsToolbar } from "./reports-toolbar"
import { useReportsPeriodCtx } from "./reports-period-context"
import type { ExportableReportType } from "@/lib/api/reports"

interface ReportPageShellProps {
  title: string
  description?: string
  exportType: ExportableReportType
  children: ReactNode
}

/**
 * Wraps every report page with: header + toolbar + content area.
 * Period state is provided via context from the route layout.
 */
export function ReportPageShell({
  title,
  description,
  exportType,
  children,
}: ReportPageShellProps) {
  const period = useReportsPeriodCtx()
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={title} description={description} />
      <ReportsToolbar
        period={period.period}
        onPeriodChange={period.setPeriod}
        dateFrom={period.normalizedFrom}
        dateTo={period.apiDateTo}
        customFrom={period.customFrom}
        customTo={period.customTo}
        onCustomFromChange={period.setCustomFrom}
        onCustomToChange={period.setCustomTo}
        branchId={period.branchId}
        onBranchIdChange={period.setBranchId}
        exportType={exportType}
        filenameDateTo={period.filenameDateTo}
      />
      {children}
    </div>
  )
}
