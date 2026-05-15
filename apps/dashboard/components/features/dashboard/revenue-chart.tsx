"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@sawaa/ui"
import { Card } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchRevenueReport } from "@/lib/api/reports"
import { formatLocaleDate } from "@/lib/date"
import { formatPrice } from "@/lib/money"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

function getWeekRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const dateTo = now.toISOString().slice(0, 10)
  const from = new Date(now)
  from.setDate(now.getDate() - 6)
  const dateFrom = from.toISOString().slice(0, 10)
  return { dateFrom, dateTo }
}

function formatDayLabel(dateStr: string, locale: string): string {
  return formatLocaleDate(dateStr, locale, { weekday: "short" })
}

export function RevenueChart() {
  const { locale, t } = useLocale()
  const { dateFrom, dateTo } = getWeekRange()

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.reports.revenue({ dateFrom, dateTo }),
    queryFn: () => fetchRevenueReport({ dateFrom, dateTo }),
  })

  const days = data?.byDay ?? []
  const maxAmount = days.reduce((m, d) => Math.max(m, d.amount), 0)
  const total = days.reduce((sum, d) => sum + d.amount, 0)
  const nonZero = days.filter((d) => d.amount > 0).length
  const avg = nonZero > 0 ? total / nonZero : 0
  const currency = t("dashboard.currency")

  return (
    <Card className="px-6 py-5" data-testid="revenue-chart">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("dashboard.weeklyRevenue")}</h2>
        <Link
          href="/reports"
          className="group inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          {t("dashboard.fullReport")}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={12}
            className="rtl:rotate-180 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5"
          />
        </Link>
      </div>

      {!isLoading && !isError && days.length > 0 && total > 0 && (
        <div className="mb-5 flex items-baseline gap-5">
          <div>
            <p className="text-[22px] font-semibold leading-none tabular-nums text-foreground">
              {formatPrice(total, { locale })} <span className="text-sm font-medium text-muted-foreground">{currency}</span>
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("dashboard.weeklyRevenue")}
            </p>
          </div>
          {avg > 0 && (
            <div>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatPrice(avg, { locale })} <span className="font-normal text-muted-foreground">{currency}</span>
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("dashboard.weeklyAverage") ?? ""}
              </p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-[160px] items-end gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`bar-${i}`} className="flex flex-1 flex-col items-center gap-2">
              <Skeleton
                className="mt-auto w-full rounded-t-md"
                style={{ height: `${40 + (i % 3) * 20}%` }}
              />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("dashboard.error.revenue")}
        </p>
      ) : days.length === 0 || maxAmount === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("dashboard.noRevenueData")}
        </p>
      ) : (
        <div className="relative h-[160px]">
          <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col justify-between" aria-hidden>
            <div className="h-px bg-border/50" />
            <div className="h-px bg-border/40" />
            <div className="h-px bg-border/60" />
          </div>
          <div className="relative flex h-full items-end gap-3">
            {days.map((day) => {
              const heightPct = maxAmount > 0
                ? Math.max(3, Math.round((day.amount / maxAmount) * 100))
                : 3
              const formatted = `${formatPrice(day.amount, { locale })} ${currency}`
              return (
                <div key={day.date} className="group/bar flex h-full flex-1 flex-col items-center gap-2 pb-6">
                  <div
                    title={formatted}
                    className="mt-auto w-full cursor-default rounded-t-md bg-primary/70 transition-colors duration-150 hover:bg-primary"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="absolute bottom-0 text-[11px] text-muted-foreground">
                    {formatDayLabel(day.date, locale)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
