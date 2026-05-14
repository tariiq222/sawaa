"use client"

import { useQuery } from "@tanstack/react-query"
import { ErrorBanner } from "@/components/features/error-banner"
import { queryKeys } from "@/lib/query-keys"
import { fetchRevenueReport } from "@/lib/api/reports"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { Skeleton } from "@sawaa/ui"
import {
  MoneyBag02Icon,
  MoneyReceiveSquareIcon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons"

interface RevenueTabProps {
  dateFrom: string
  dateTo: string
}

export function RevenueTab({ dateFrom, dateTo }: RevenueTabProps) {
  const { t, locale } = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.revenue({ dateFrom, dateTo }),
    queryFn: () => fetchRevenueReport({ dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo,
  })

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <StatsGrid className="lg:grid-cols-3">
          <StatCard
            title={t("reports.revenue.total")}
            value={<FormattedCurrency amount={data.totalRevenue} locale={locale} />}
            icon={MoneyBag02Icon}
            iconColor="success"
          />
          <StatCard
            title={t("reports.revenue.avg")}
            value={<FormattedCurrency amount={data.averagePerBooking} locale={locale} />}
            icon={MoneyReceiveSquareIcon}
            iconColor="primary"
          />
          <StatCard
            title={t("reports.revenue.bookings")}
            value={data.totalBookings}
            icon={Calendar03Icon}
            iconColor="warning"
          />
        </StatsGrid>
      ) : null}
    </div>
  )
}
