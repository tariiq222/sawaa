"use client"

import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { Skeleton } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { DatePicker } from "@/components/ui/date-picker"

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
  } = useActivityLogs()

  const columns = getActivityLogColumns(t, locale)

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={module ?? "all"}
          onValueChange={(v) => setModule(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t("activityLog.module")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("activityLog.allModules")}</SelectItem>
            {MODULES.map((m) => (
              <SelectItem key={m} value={m} className="capitalize">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={action ?? "all"}
          onValueChange={(v) => setAction(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t("activityLog.action")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("activityLog.allActions")}</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a} className="capitalize">
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePicker
          value={dateFrom}
          onChange={setDateFrom}
          placeholder={t("activityLog.from")}
          className="w-full sm:w-40"
        />
        <DatePicker
          value={dateTo}
          onChange={setDateTo}
          placeholder={t("activityLog.to")}
          className="w-full sm:w-40"
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t("activityLog.reset")}
          </Button>
        )}
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Table */}
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
