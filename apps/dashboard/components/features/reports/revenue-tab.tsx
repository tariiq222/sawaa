"use client"

import { useQuery } from "@tanstack/react-query"
import { ErrorBanner } from "@/components/features/error-banner"
import { queryKeys } from "@/lib/query-keys"
import { fetchRevenueReport } from "@/lib/api/reports"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoneyBag02Icon } from "@hugeicons/core-free-icons"

/** Maps raw payment method string to a translation key */
function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CARD: "reports.paymentMethod.CARD",
    BANK_TRANSFER: "reports.paymentMethod.BANK_TRANSFER",
    CASH: "reports.paymentMethod.CASH",
    mada: "reports.paymentMethod.mada",
    apple_pay: "reports.paymentMethod.apple_pay",
  }
  return map[method] ?? "reports.paymentMethod.unknown"
}

/** Returns a bg/text token pair for a given payment method */
function methodStyle(method: string): { bg: string; text: string } {
  const lower = method.toLowerCase()
  if (lower.includes("bank") || lower.includes("transfer")) {
    return { bg: "bg-primary/10", text: "text-primary" }
  }
  if (lower.includes("cash")) {
    return { bg: "bg-success/10", text: "text-success" }
  }
  if (lower.includes("mada")) {
    return { bg: "bg-accent/10", text: "text-accent" }
  }
  return { bg: "bg-muted", text: "text-muted-foreground" }
}

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

  const methods = data?.byMethod ?? []

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data && methods.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.revenue.byMethod")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {methods.map((item) => {
                const style = methodStyle(item.method)
                const labelKey = paymentMethodLabel(item.method)
                return (
                  <div key={item.method} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex size-8 items-center justify-center rounded-lg",
                          style.bg,
                        )}
                        aria-hidden
                      >
                        <HugeiconsIcon icon={MoneyBag02Icon} size={16} className={style.text} />
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {t(labelKey)}
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-sm tabular-nums font-medium text-foreground">
                        <FormattedCurrency amount={item.amount} locale={locale} />
                      </span>
                      <span
                        className={cn(
                          "min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums",
                          style.bg,
                          style.text,
                        )}
                      >
                        {item.count}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t("reports.revenue.noPayments")}</p>
      )}
    </div>
  )
}
