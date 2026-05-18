"use client"

import { useState } from "react"
import { subDays, format } from "date-fns"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { FilterBar } from "@/components/features/filter-bar"
import { EmployeeCombobox } from "@/components/features/reports/employee-combobox"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { RevenueTab } from "@/components/features/reports/revenue-tab"
import { BookingsTab } from "@/components/features/reports/bookings-tab"
import { EmployeesTab } from "@/components/features/reports/employees-tab"
import { exportReportExcel } from "@/lib/api/reports"
import { toast } from "sonner"
import { PermissionGuard } from "@/components/features/permission-guard"

const today = format(new Date(), "yyyy-MM-dd")
const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd")

function ReportsContent() {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState("revenue")
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [exporting, setExporting] = useState(false)

  // Normalize: ensure from <= to for API calls (prevents RTL date confusion)
  const normalizedFrom = dateFrom <= dateTo ? dateFrom : dateTo
  const normalizedTo = dateFrom <= dateTo ? dateTo : dateFrom

  const canExportExcel = activeTab === "revenue"

  const handleExport = async () => {
    if (!canExportExcel) return
    setExporting(true)
    try {
      await exportReportExcel({
        type: "REVENUE",
        dateFrom: normalizedFrom,
        dateTo: normalizedTo,
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

      {/* Date Filter — shared across all tabs */}
      <FilterBar
        dateRange={{
          dateFrom,
          dateTo,
          onDateFromChange: setDateFrom,
          onDateToChange: setDateTo,
          placeholderFrom: t("reports.dateFrom"),
          placeholderTo: t("reports.dateTo"),
        }}
        hasFilters={dateFrom !== thirtyDaysAgo || dateTo !== today}
        onReset={() => { setDateFrom(thirtyDaysAgo); setDateTo(today) }}
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
          <RevenueTab dateFrom={normalizedFrom} dateTo={normalizedTo} />
        </TabsContent>

        <TabsContent value="bookings">
          <BookingsTab dateFrom={normalizedFrom} dateTo={normalizedTo} />
        </TabsContent>

        <TabsContent value="employees">
          <div className="flex flex-col gap-4 pt-2">
            <EmployeeCombobox
              value={selectedEmployeeId}
              onChange={setSelectedEmployeeId}
            />
            <EmployeesTab
              dateFrom={normalizedFrom}
              dateTo={normalizedTo}
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
