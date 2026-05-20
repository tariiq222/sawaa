"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchBookings } from "@/lib/api/bookings"
import { formatPrice } from "@/lib/money"
import { useLocale } from "@/components/locale-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Money01Icon } from "@hugeicons/core-free-icons"
import type { Booking, BookingStatus, BookingType } from "@/lib/types/booking"
import {
  DonutChart, LineChart, PeriodSelector,
  type Period, type LinePoint,
} from "./employee-chart-primitives"

/* ─── Constants ─── */

const STATUS_HEX: Record<BookingStatus, string> = {
  completed: "hsl(var(--success))",
  confirmed: "hsl(var(--primary))",
  pending: "hsl(var(--warning))",
  pending_group_fill: "hsl(var(--warning))",
  awaiting_payment: "hsl(var(--warning))",
  cancelled: "hsl(var(--error))",
  cancel_requested: "hsl(var(--warning))",
  no_show: "hsl(var(--muted-foreground))",
  expired: "hsl(var(--muted))",
}
const TYPE_HEX: Record<BookingType, string> = {
  individual: "hsl(var(--primary))",
  walk_in: "hsl(var(--accent))",
  group: "hsl(var(--accent))",
}
const STATUS_KEY: Record<BookingStatus, string> = {
  completed: "employees.chart.status.completed",
  confirmed: "employees.chart.status.confirmed",
  pending: "employees.chart.status.pending",
  pending_group_fill: "employees.chart.status.pending",
  awaiting_payment: "employees.chart.status.pending",
  cancelled: "employees.chart.status.cancelled",
  cancel_requested: "employees.chart.status.pendingCancellation",
  no_show: "employees.chart.status.noShow",
  expired: "employees.chart.status.expired",
}
const TYPE_KEY: Record<BookingType, string> = {
  individual: "employees.chart.type.individual",
  walk_in: "employees.chart.type.walkIn",
  group: "employees.chart.type.group",
}
const STATUSES: BookingStatus[] = ["completed", "confirmed", "pending", "cancelled", "no_show", "cancel_requested"]
const TYPES: BookingType[] = ["individual", "group", "walk_in"]

/* ─── Helpers ─── */

function getRange(period: Period): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const dateTo = now.toISOString().slice(0, 10)
  const from = new Date(now)
  from.setDate(now.getDate() - (period === "1m" ? 29 : period === "3m" ? 89 : 179))
  return { dateFrom: from.toISOString().slice(0, 10), dateTo }
}

function groupByDay(bookings: Booking[]): { date: string; count: number; revenue: number }[] {
  const map: Record<string, { count: number; revenue: number }> = {}
  bookings.forEach((b) => {
    const d = b.date.slice(0, 10)
    if (!map[d]) map[d] = { count: 0, revenue: 0 }
    map[d].count++
    if (b.payment?.status === "paid") map[d].revenue += b.payment.totalAmount ?? 0
  })
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))
}

/**
 * Chart axis label formatter — uses locale-aware abbreviated month names.
 * This is intentionally kept as toLocaleDateString because chart labels
 * need short month names (e.g. "Jan", "يناير"), not the clinic's configured date format.
 */
function fmtDate(dateStr: string, locale: string, period: Period): string {
  const opts: Intl.DateTimeFormatOptions = period === "6m"
    ? { month: "short" } : { day: "numeric", month: "short" }
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", opts)
}

function fmtRevenue(halalat: number, _locale: string): string {
  return formatPrice(halalat, { decimals: 0, locale: "en" })
}

/* ─── Main ─── */

interface Props { employeeId: string }

export function EmployeeBookingsChart({ employeeId }: Props) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"

  const [donutPeriod, setDonutPeriod] = useState<Period>("1m")
  const [barPeriod, setBarPeriod] = useState<Period>("1m")
  const [linePeriod, setLinePeriod] = useState<Period>("1m")

  const { data: donutData, isLoading: donutLoading } = useQuery({
    queryKey: ["pbc-donut", employeeId, donutPeriod],
    queryFn: () => fetchBookings({ employeeId, ...getRange(donutPeriod), perPage: 200 }),
    enabled: !!employeeId,
  })
  const { data: barData, isLoading: barLoading } = useQuery({
    queryKey: ["pbc-bar", employeeId, barPeriod],
    queryFn: () => fetchBookings({ employeeId, ...getRange(barPeriod), perPage: 200 }),
    enabled: !!employeeId,
  })
  const { data: lineData, isLoading: lineLoading } = useQuery({
    queryKey: ["pbc-line", employeeId, linePeriod],
    queryFn: () => fetchBookings({ employeeId, ...getRange(linePeriod), perPage: 200 }),
    enabled: !!employeeId,
  })

  const donutBookings = donutData?.items ?? []
  const barBookings = barData?.items ?? []
  const lineBookings = lineData?.items ?? []

  const statusSegs = STATUSES.map((s) => ({
    value: donutBookings.filter((b) => b.status === s).length,
    color: STATUS_HEX[s],
    label: t(STATUS_KEY[s]),
  }))
  const typeSegs = TYPES.map((type) => ({
    value: donutBookings.filter((b) => b.type === type).length,
    color: TYPE_HEX[type],
    label: t(TYPE_KEY[type]),
  }))

  const barByDay = groupByDay(barBookings)
  const maxCount = Math.max(...barByDay.map((d) => d.count), 1)

  const lineByDay = groupByDay(lineBookings)
  const totalRevenue = lineByDay.reduce((s, d) => s + d.revenue, 0)
  const linePoints: LinePoint[] = lineByDay.map((d, i) => ({
    x: i, y: d.revenue,
    label: fmtDate(d.date, locale, linePeriod),
    value: d.revenue,
  }))

  return (
    <div className="flex flex-col gap-4">

      {/* Row 1 — Donuts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                  <HugeiconsIcon icon={Calendar03Icon} size={13} className="text-primary" />
                </div>
                {t("employees.chart.bookingsByStatus")}
              </CardTitle>
              <PeriodSelector value={donutPeriod} onChange={setDonutPeriod} isAr={isAr} />
            </div>
          </CardHeader>
          <CardContent>
            {donutLoading
              ? <Skeleton className="mx-auto size-[120px] rounded-full" />
              : <DonutChart segments={statusSegs} total={donutBookings.length} emptyLabel={t("employees.chart.noBookings")} />
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="flex size-6 items-center justify-center rounded-md bg-accent/10">
                  <HugeiconsIcon icon={Calendar03Icon} size={13} className="text-accent" />
                </div>
                {t("employees.chart.bookingsByType")}
              </CardTitle>
              <PeriodSelector value={donutPeriod} onChange={setDonutPeriod} isAr={isAr} />
            </div>
          </CardHeader>
          <CardContent>
            {donutLoading
              ? <Skeleton className="mx-auto size-[120px] rounded-full" />
              : <DonutChart segments={typeSegs} total={donutBookings.length} emptyLabel={t("employees.chart.noBookings")} />
            }
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — Bar + Line */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Bar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                  <HugeiconsIcon icon={Calendar03Icon} size={13} className="text-primary" />
                </div>
                {t("employees.chart.bookings")}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums font-semibold text-foreground">
                  {barBookings.length} {t("employees.chart.total")}
                </span>
                <PeriodSelector value={barPeriod} onChange={setBarPeriod} isAr={isAr} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {barLoading ? (
              <Skeleton className="h-[100px] w-full rounded-md" />
            ) : barByDay.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("employees.chart.noData")}</p>
            ) : (
              <>
                <div className="flex items-end gap-0.5" style={{ height: 100 }}>
                  {barByDay.map((d) => (
                    <div key={d.date} className="flex flex-1 flex-col" style={{ height: "100%" }}>
                      <div
                        title={`${fmtDate(d.date, locale, barPeriod)}: ${d.count} ${t("employees.chart.bookings")}`}
                        className="w-full rounded-t-sm bg-primary/60 transition-all hover:bg-primary cursor-default"
                        style={{ height: `${Math.max(3, Math.round((d.count / maxCount) * 100))}%`, marginTop: "auto" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between">
                  <span className="text-[10px] tabular-nums text-muted-foreground">{fmtDate(barByDay[0].date, locale, barPeriod)}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{fmtDate(barByDay[barByDay.length - 1].date, locale, barPeriod)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Line */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="flex size-6 items-center justify-center rounded-md bg-success/10">
                  <HugeiconsIcon icon={Money01Icon} size={13} className="text-success" />
                </div>
                {t("employees.chart.revenue")}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums font-semibold text-success">
                  {fmtRevenue(totalRevenue, locale)} {t("employees.chart.sar")}
                </span>
                <PeriodSelector value={linePeriod} onChange={setLinePeriod} isAr={isAr} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {lineLoading ? (
              <Skeleton className="h-[100px] w-full rounded-md" />
            ) : linePoints.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("employees.chart.noRevenue")}</p>
            ) : (
              <>
                <LineChart
                  points={linePoints}
                  color="hsl(var(--success))"
                  height={100}
                  formatValue={(v) => `${fmtRevenue(v, locale)} ${t("employees.chart.sar")}`}
                />
                <div className="mt-1.5 flex justify-between">
                  <span className="text-[10px] tabular-nums text-muted-foreground">{fmtDate(lineByDay[0].date, locale, linePeriod)}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{fmtDate(lineByDay[lineByDay.length - 1].date, locale, linePeriod)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
