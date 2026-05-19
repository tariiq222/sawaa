"use client"

import { useQuery } from "@tanstack/react-query"
import { ErrorBanner } from "@/components/features/error-banner"
import { queryKeys } from "@/lib/query-keys"
import { fetchBookingReport } from "@/lib/api/reports"
import { useLocale } from "@/components/locale-provider"
import { bookingStatusStyles, bookingTypeStyles } from "@/lib/ds"
import { Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { cn } from "@/lib/utils"

interface BookingsTabProps {
  dateFrom: string
  dateTo: string
}

export function BookingsTab({ dateFrom, dateTo }: BookingsTabProps) {
  const { t } = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.bookings({ dateFrom, dateTo }),
    queryFn: () => fetchBookingReport({ dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo,
  })

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* By Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t("reports.bookings.byStatus")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {Array.isArray(data.byStatus) && data.byStatus.length > 0 ? (
                  data.byStatus.map((item) => {
                    const styleKey = item.status.toLowerCase() as keyof typeof bookingStatusStyles
                    const style = bookingStatusStyles[styleKey] ?? {
                      bg: "bg-muted",
                      text: "text-muted-foreground",
                      border: "border-border",
                    }
                    return (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              style.bg,
                              style.text,
                            )}
                          >
                            {t(`reports.bookingStatus.${item.status}`)}
                          </span>
                        </div>
                        <span className="text-sm font-medium tabular-nums text-foreground">
                          {item.count}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* By Type */}
          <Card>
            <CardHeader>
              <CardTitle>{t("reports.bookings.byType")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {Array.isArray(data.byType) && data.byType.length > 0 ? (
                  data.byType.map((item) => {
                    const styleKey = item.type.toLowerCase() as keyof typeof bookingTypeStyles
                    const style = bookingTypeStyles[styleKey] ?? {
                      bg: "bg-muted",
                      text: "text-muted-foreground",
                      border: "border-border",
                    }
                    return (
                      <div key={item.type} className="flex items-center justify-between">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            style.bg,
                            style.text,
                          )}
                        >
                          {t(`reports.bookingType.${item.type}`)}
                        </span>
                        <span className="text-sm font-medium tabular-nums text-foreground">
                          {item.count}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
