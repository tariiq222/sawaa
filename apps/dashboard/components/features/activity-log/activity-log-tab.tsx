"use client"

import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { FilterBar } from "@/components/features/filter-bar"
import { Skeleton } from "@sawaa/ui"

import { getActivityLogColumns } from "@/components/features/shared/activity-log-columns"
import { useActivityLogs } from "@/hooks/use-activity-log"
import { useLocale } from "@/components/locale-provider"

import { ACTIVITY_MODULES as MODULES, ACTIVITY_ACTIONS as ACTIONS, activityModuleLabel, activityActionLabel } from "@/lib/activity-log-label"

export function ActivityLogTab() {
  const { t, locale } = useLocale()
  const {
    logs,
    meta, page, setPage,
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
              ...MODULES.map((m) => ({ value: m, label: activityModuleLabel(m, t) })),
            ],
            onValueChange: (v) => setModule(v === "all" ? undefined : v),
          },
          {
            key: "action",
            value: action ?? "all",
            placeholder: t("activityLog.action"),
            options: [
              { value: "all", label: t("activityLog.allActions") },
              ...ACTIONS.map((a) => ({ value: a, label: activityActionLabel(a, t) })),
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
          serverPaginated
          page={page}
          totalPages={meta?.totalPages ?? 1}
          hasPreviousPage={meta?.hasPreviousPage ?? false}
          hasNextPage={meta?.hasNextPage ?? false}
          onPageChange={setPage}
          emptyTitle={t("activityLog.empty.title")}
          emptyDescription={t("activityLog.empty.description")}
        />
      )}
    </div>
  )
}
