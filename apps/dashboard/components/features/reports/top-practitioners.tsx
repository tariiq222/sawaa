"use client"

import { useQuery } from "@tanstack/react-query"
import { ErrorBanner } from "@/components/features/error-banner"
import { queryKeys } from "@/lib/query-keys"
import { fetchEmployeeReport } from "@/lib/api/reports"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Card, CardContent } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserGroupIcon } from "@hugeicons/core-free-icons"
import type { TopPractitionersReport } from "@/lib/types/report"

interface TopPractitionersProps {
  dateFrom: string
  dateTo: string
}

export function TopPractitioners({ dateFrom, dateTo }: TopPractitionersProps) {
  const { t, locale } = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.employee("__top__", { dateFrom, dateTo }),
    queryFn: () => fetchEmployeeReport({ dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo,
  })

  const practitioners = Array.isArray(data)
    ? (data as TopPractitionersReport[])
    : []

  // Sort by totalRevenue desc, then completedBookings desc, take top 3
  const top3 = [...practitioners]
    .sort((a, b) => {
      if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue
      return b.completedBookings - a.completedBookings
    })
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`tp-skeleton-${i}`} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : top3.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {top3.map((p, i) => (
            <Card key={p.employeeId} className="card-lift relative h-full px-4 py-4">
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <HugeiconsIcon icon={UserGroupIcon} size={18} />
                  </div>
                  <span
                    className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning"
                    aria-label={`${t("reports.summary.rank")}${i + 1}`}
                  >
                    #{i + 1}
                  </span>
                </div>
                <div>
                  <p className="truncate font-medium text-foreground">
                    {p.displayName || `#${p.employeeId}`}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    <FormattedCurrency amount={p.totalRevenue} locale={locale} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.totalBookings} {t("reports.summary.bookings")}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="py-12 text-center">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("reports.summary.noPractitioners")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}