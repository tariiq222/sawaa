"use client"

import { useState } from "react"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { EmployeeCombobox } from "@/components/features/reports/employee-combobox"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ExecutiveSummary } from "@/components/features/reports/executive-summary"
import { TopPractitioners } from "@/components/features/reports/top-practitioners"
import { RevenueTab } from "@/components/features/reports/revenue-tab"
import { BookingsTab } from "@/components/features/reports/bookings-tab"
import { EmployeesTab } from "@/components/features/reports/employees-tab"
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
  const [activeTab, setActiveTab] = useState("revenue")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
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

  const canExportExcel = activeTab === "revenue"

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
    if (!canExportExcel) return
    setExporting(true)
    try {
      await exportReportExcel({
        type: "REVENUE",
        dateFrom: normalizedFrom,
        dateTo: apiDateTo,
      })
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
        {canExportExcel && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? t("reports.exporting") : t("reports.exportCsv")}
          </Button>
        )}
      </PageHeader>

      <ExecutiveSummary
        dateFrom={normalizedFrom}
        dateTo={apiDateTo}
      />

      <TopPractitioners
        dateFrom={normalizedFrom}
        dateTo={apiDateTo}
      />

      <ReportsPeriodFilter
        period={period}
        dateFrom={normalizedFrom}
        dateTo={normalizedTo}
        onPeriodChange={handlePeriodChange}
        onDateFromChange={handleCustomFromChange}
        onDateToChange={handleCustomToChange}
        onReset={handleReset}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="revenue">{t("reports.tabs.revenue")}</TabsTrigger>
            <TabsTrigger value="bookings">{t("reports.tabs.bookings")}</TabsTrigger>
            <TabsTrigger value="employees">{t("reports.tabs.employees")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="revenue">
          <RevenueTab dateFrom={normalizedFrom} dateTo={apiDateTo} />
        </TabsContent>

        <TabsContent value="bookings">
          <BookingsTab dateFrom={normalizedFrom} dateTo={apiDateTo} />
        </TabsContent>

        <TabsContent value="employees">
          <div className="flex flex-col gap-4 pt-2">
            <EmployeeCombobox
              value={selectedEmployeeId}
              onChange={setSelectedEmployeeId}
            />
            <EmployeesTab
              dateFrom={normalizedFrom}
              dateTo={apiDateTo}
              employeeId={selectedEmployeeId}
            />
          </div>
        </TabsContent>
      </Tabs>
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
