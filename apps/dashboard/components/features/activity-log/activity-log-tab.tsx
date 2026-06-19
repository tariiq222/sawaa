"use client"

import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { FilterBar } from "@/components/features/filter-bar"
import { Skeleton } from "@sawaa/ui"

import { getActivityLogColumns } from "@/components/features/activity-log/activity-log-columns"
import { useActivityLogs } from "@/hooks/use-activity-log"
import { useLocale } from "@/components/locale-provider"

const MODULES = [
  "bookings", "users", "employees", "payments",
  "invoices", "services", "roles", "branding", "ratings",
]

const ACTIONS = [
  "created", "updated", "deleted", "login", "logout", "approved", "rejected",
]

export function ActivityLogTab() {
  const { t, locale } = useLocale()
  const {
    logs,
    isLoading,
    error,
    module,
    setModule,
    action,
    setAction,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    hasFilters,
    resetFilters,
    refetch,
  } = useActivityLogs()

  const columns = getActivityLogColumns(t, locale)

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        selects={[
          {
            key: "module",
            value: module ?? "all",
            placeholder: t("activityLog.module"),
            options: [
              { value: "all", label: t("activityLog.allModules") },
              ...MODULES.map((m) => ({ value: m, label: m })),
            ],
            onValueChange: (v) => setModule(v === "all" ? undefined : v),
          },
          {
            key: "action",
            value: action ?? "all",
            placeholder: t("activityLog.action"),
            options: [
              { value: "all", label: t("activityLog.allActions") },
              ...ACTIONS.map((a) => ({ value: a, label: a })),
            ],
            onValueChange: (v) => setAction(v === "all" ? undefined : v),
          },
        ]}
        dateRange={{
          dateFrom,
          dateTo,
          onDateFromChange: setDateFrom,
          onDateToChange: setDateTo,
          placeholderFrom: t("activityLog.from"),
          placeholderTo: t("activityLog.to"),
        }}
        hasFilters={hasFilters}
        onReset={resetFilters}
      />

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && logs.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          emptyTitle={t("activityLog.empty.title")}
          emptyDescription={t("activityLog.empty.description")}
        />
      )}
    </div>
  )
}
