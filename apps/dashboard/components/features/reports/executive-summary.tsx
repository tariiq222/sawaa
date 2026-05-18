"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchRevenueReport } from "@/lib/api/reports"
import { fetchBookingReport } from "@/lib/api/reports"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { Skeleton } from "@sawaa/ui"
import {
  MoneyBag02Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  ArrowUp01Icon,
} from "@hugeicons/core-free-icons"

interface ExecutiveSummaryProps {
  dateFrom: string
  dateTo: string
}

export function ExecutiveSummary({ dateFrom, dateTo }: ExecutiveSummaryProps) {
  const { t, locale } = useLocale()

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: queryKeys.reports.revenue({ dateFrom, dateTo }),
    queryFn: () => fetchRevenueReport({ dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo,
  })

  const { data: bookingData, isLoading: bookingLoading } = useQuery({
    queryKey: queryKeys.reports.bookings({ dateFrom, dateTo }),
    queryFn: () => fetchBookingReport({ dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo,
  })

  const isLoading = revenueLoading || bookingLoading
  const hasData = revenueData || bookingData

  // Derive marketing/operational summary from booking data
  const totalBookings = revenueData?.totalBookings ?? 0
  const completedBookings =
    bookingData?.byStatus?.find((s) => s.status === "COMPLETED")?.count ?? 0
  const confirmedBookings =
    bookingData?.byStatus?.find((s) => s.status === "CONFIRMED")?.count ?? 0
  const pendingBookings =
    bookingData?.byStatus?.find((s) => s.status === "PENDING")?.count ?? 0

  if (!hasData && !isLoading) return null

  return (
    <section className="flex flex-col gap-4">
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`exec-skeleton-${i}`} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Financial Summary */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("reports.summary.financial")}
            </p>
            <StatsGrid>
              <StatCard
                title={t("reports.revenue.total")}
                value={
                  <FormattedCurrency
                    amount={revenueData?.totalRevenue ?? 0}
                    locale={locale}
                  />
                }
                icon={MoneyBag02Icon}
                iconColor="success"
              />
              <StatCard
                title={t("reports.revenue.avg")}
                value={
                  <FormattedCurrency
                    amount={revenueData?.averagePerBooking ?? 0}
                    locale={locale}
                  />
                }
                icon={ArrowUp01Icon}
                iconColor="primary"
              />
              <StatCard
                title={t("reports.revenue.bookings")}
                value={totalBookings}
                icon={Calendar03Icon}
                iconColor="warning"
              />
            </StatsGrid>
          </div>

          {/* Marketing / Operational Summary */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("reports.summary.operational")}
            </p>
            <StatsGrid>
              <StatCard
                title={t("reports.summary.completedBookings")}
                value={completedBookings}
                icon={CheckmarkCircle02Icon}
                iconColor="success"
              />
              <StatCard
                title={t("reports.summary.confirmedBookings")}
                value={confirmedBookings}
                icon={CheckmarkCircle02Icon}
                iconColor="primary"
              />
              <StatCard
                title={t("reports.summary.pendingBookings")}
                value={pendingBookings}
                icon={Calendar03Icon}
                iconColor="warning"
              />
            </StatsGrid>
          </div>
        </>
      )}
    </section>
  )
}