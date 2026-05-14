"use client"

import { ErrorBanner } from "@/components/features/error-banner"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchEmployeeReport } from "@/lib/api/reports"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { Skeleton } from "@sawaa/ui"
import {
  Calendar03Icon,
  CheckmarkCircle02Icon,
  MoneyBag02Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"

interface EmployeesTabProps {
  dateFrom: string
  dateTo: string
  employeeId: string
}

export function EmployeesTab({ dateFrom, dateTo, employeeId }: EmployeesTabProps) {
  const { t, locale } = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.employee(employeeId, { dateFrom, dateTo }),
    queryFn: () => fetchEmployeeReport({ employeeId, dateFrom, dateTo }),
    enabled: !!employeeId && !!dateFrom && !!dateTo,
  })

  if (!employeeId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {t("reports.employeeSearchHint")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <StatsGrid>
          <StatCard
            title={t("reports.revenue.bookings")}
            value={data.totalBookings}
            icon={Calendar03Icon}
            iconColor="primary"
          />
          <StatCard
            title={t("bookings.stats.completed")}
            value={data.completedBookings}
            icon={CheckmarkCircle02Icon}
            iconColor="success"
          />
          <StatCard
            title={t("reports.revenue.total")}
            value={<FormattedCurrency amount={data.totalRevenue} locale={locale} />}
            icon={MoneyBag02Icon}
            iconColor="success"
          />
          <StatCard
            title={t("employees.stats.avgRating")}
            value={data.averageRating.toFixed(1)}
            icon={StarIcon}
            iconColor="warning"
          />
        </StatsGrid>
      ) : null}
    </div>
  )
}
