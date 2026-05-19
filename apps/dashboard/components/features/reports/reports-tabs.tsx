"use client"

import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { EmployeeCombobox } from "@/components/features/reports/employee-combobox"
import { RevenueTab } from "@/components/features/reports/revenue-tab"
import { BookingsTab } from "@/components/features/reports/bookings-tab"
import { EmployeesTab } from "@/components/features/reports/employees-tab"

interface ReportsTabsProps {
  dateFrom: string
  dateTo: string
  employeeId: string
  onEmployeeIdChange: (id: string) => void
  /** Optional: pass to control the active tab from the parent (controlled mode) */
  activeTab?: string
  /** Optional: callback fired when the user switches tabs (required when activeTab is passed) */
  onActiveTabChange?: (tab: string) => void
}

export function ReportsTabs({
  dateFrom,
  dateTo,
  employeeId,
  onEmployeeIdChange,
  activeTab: controlledActiveTab,
  onActiveTabChange,
}: ReportsTabsProps) {
  const { t } = useLocale()
  const [internalActiveTab, setInternalActiveTab] = useState("revenue")
  // Controlled mode takes precedence; otherwise use internal state
  const activeTab = controlledActiveTab ?? internalActiveTab
  const setActiveTab = onActiveTabChange ?? setInternalActiveTab

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="overflow-x-auto">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="revenue">{t("reports.tabs.revenue")}</TabsTrigger>
          <TabsTrigger value="bookings">{t("reports.tabs.bookings")}</TabsTrigger>
          <TabsTrigger value="employees">{t("reports.tabs.employees")}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="revenue">
        <RevenueTab dateFrom={dateFrom} dateTo={dateTo} />
      </TabsContent>

      <TabsContent value="bookings">
        <BookingsTab dateFrom={dateFrom} dateTo={dateTo} />
      </TabsContent>

      <TabsContent value="employees">
        <div className="flex flex-col gap-4 pt-2">
          <EmployeeCombobox value={employeeId} onChange={onEmployeeIdChange} />
          <EmployeesTab dateFrom={dateFrom} dateTo={dateTo} employeeId={employeeId} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
