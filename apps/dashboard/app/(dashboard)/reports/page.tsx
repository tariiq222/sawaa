"use client"

import { useState } from "react"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ExecutiveSummary } from "@/components/features/reports/executive-summary"
import { TopPractitioners } from "@/components/features/reports/top-practitioners"
import { ReportsTabs } from "@/components/features/reports/reports-tabs"
import { exportReportExcel } from "@/lib/api/reports"
import { toast } from "sonner"
import { PermissionGuard } from "@/components/features/permission-guard"
import {
  ReportsPeriodFilter,
  type ReportsPeriodPreset,
} from "@/components/features/reports/period-filter"
import { useReportsPeriod } from "@/hooks/use-reports-period"

function ReportsContent() {
  const { t } = useLocale()
  const [employeeId, setEmployeeId] = useState("")
  const [activeTab, setActiveTab] = useState("revenue")
  const [exporting, setExporting] = useState(false)

  const {
    period,
    setPeriod,
    setCustomFrom,
    setCustomTo,
    normalizedFrom,
    normalizedTo,
    apiDateTo,
  } = useReportsPeriod()

  const handlePeriodChange = (newPeriod: ReportsPeriodPreset) => {
    setPeriod(newPeriod)
    if (newPeriod !== "custom") {
      setCustomFrom("")
      setCustomTo("")
    }
  }

  const handleCustomFromChange = (v: string) => {
    setCustomFrom(v)
    setPeriod("custom")
  }

  const handleCustomToChange = (v: string) => {
    setCustomTo(v)
    setPeriod("custom")
  }

  const handleReset = () => {
    setPeriod("monthly")
    setCustomFrom("")
    setCustomTo("")
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportReportExcel({ type: "REVENUE", dateFrom: normalizedFrom, dateTo: apiDateTo })
    } catch {
      toast.error(t("reports.exportError"))
    } finally {
      setExporting(false)
    }
  }

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
      >
        {activeTab === "revenue" && (
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? t("reports.exporting") : t("reports.exportCsv")}
          </Button>
        )}
      </PageHeader>

      <ReportsPeriodFilter
        period={period}
        dateFrom={normalizedFrom}
        dateTo={normalizedTo}
        onPeriodChange={handlePeriodChange}
        onDateFromChange={handleCustomFromChange}
        onDateToChange={handleCustomToChange}
        onReset={handleReset}
      />

      <ExecutiveSummary dateFrom={normalizedFrom} dateTo={apiDateTo} />

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground">{t("reports.summary.label")}</p>
        <TopPractitioners dateFrom={normalizedFrom} dateTo={apiDateTo} />
      </div>

      <ReportsTabs
        dateFrom={normalizedFrom}
        dateTo={apiDateTo}
        employeeId={employeeId}
        onEmployeeIdChange={setEmployeeId}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
      />
    </ListPageShell>
  )
}

export default function ReportsPage() {
  return (
    <PermissionGuard module="report" action="read">
      <ReportsContent />
    </PermissionGuard>
  )
}
