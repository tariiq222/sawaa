"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { Skeleton } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert01Icon } from "@hugeicons/core-free-icons"
import { queryKeys } from "@/lib/query-keys"
import { fetchBookingReport } from "@/lib/api/reports"
import { ReportPageShell } from "../report-page-shell"
import { KpiRow } from "../kpi-row"
import { KpiCard } from "../kpi-card"
import { Section } from "../section"
import { DonutList } from "../donut-list"
import { DistributionBars } from "../distribution-bars"
import { Heatmap } from "../heatmap"
import { InsightBanner } from "../insight-banner"
import { ReportsEmptyState } from "../empty-state"
import { useReportsPeriodCtx } from "../reports-period-context"
import { computeDelta } from "../delta-helpers"

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "var(--success)",
  CONFIRMED: "var(--primary)",
  PENDING: "var(--muted-foreground)",
  CANCELLED: "var(--error)",
  NO_SHOW: "var(--error)",
  EXPIRED: "var(--muted-foreground)",
  AWAITING_PAYMENT: "var(--warning)",
}

const TYPE_COLORS: Record<string, string> = {
  INDIVIDUAL: "var(--chart-1)",
  GROUP: "var(--chart-3)",
  WALK_IN: "var(--chart-5)",
}

export function BookingsReportPage() {
  const { t, locale } = useLocale()
  const period = useReportsPeriodCtx()
  const params = {
    dateFrom: period.normalizedFrom,
    dateTo: period.apiDateTo,
    branchId: period.branchId,
    compareWithPrevious: true,
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.bookings(params),
    queryFn: () => fetchBookingReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })

  return (
    <ReportPageShell
      title={t("reports.bookings.title")}
      description={t("reports.bookings.description")}
      exportType="BOOKINGS"
    >
      {isLoading ? (
        <KpiRow>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </KpiRow>
      ) : !data ? (
        <ReportsEmptyState />
      ) : (
        <>
          <KpiRow>
            <KpiCard
              label={t("reports.bookings.totalBookings")}
              value={data.total.toLocaleString(locale)}
              delta={computeDelta(data.total, data.previous?.total, { format: "count" })}
            />
            <KpiCard
              label={t("reports.bookings.cancelRate")}
              value={`${(data.cancelRate * 100).toFixed(1)}٪`}
              delta={computeDelta(
                data.cancelRate,
                data.previous?.cancelRate,
                { inverse: true },
              )}
            />
            <KpiCard
              label={t("reports.bookings.noShowRate")}
              value={`${(data.noShowRate * 100).toFixed(1)}٪`}
              delta={computeDelta(
                data.noShowRate,
                data.previous?.noShowRate,
                { inverse: true },
              )}
            />
            <KpiCard
              label={t("reports.bookings.avgDuration")}
              value={`${data.avgDurationMins} د`}
              delta={computeDelta(
                data.avgDurationMins,
                data.previous?.avgDurationMins,
                { format: "count" },
              )}
            />
          </KpiRow>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title={t("reports.bookings.byStatus")}>
              <DonutList
                items={data.byStatus.map((s) => ({
                  key: s.status,
                  label: t(`reports.bookingStatus.${s.status}`),
                  value: s.count,
                  color: STATUS_COLORS[s.status] ?? "var(--muted-foreground)",
                  amount: s.count,
                }))}
                centerLabel={t("reports.bookings.bookingsLabel")}
                centerValue={data.total}
              />
            </Section>
            <Section title={t("reports.bookings.byType")}>
              <DonutList
                items={data.byType.map((tp) => ({
                  key: tp.type,
                  label: t(`reports.bookingType.${tp.type}`),
                  value: tp.count,
                  color: TYPE_COLORS[tp.type] ?? "var(--muted-foreground)",
                  amount: tp.count,
                }))}
                centerLabel={t("reports.bookings.bookingsLabel")}
                centerValue={data.total}
              />
            </Section>
          </div>

          {data.byHourDow.length > 0 && (
            <Section
              title={t("reports.bookings.peakHours")}
              subtitle={t("reports.bookings.peakHoursSubtitle")}
            >
              <Heatmap data={data.byHourDow} />
            </Section>
          )}

          {data.byCancelReason.length > 0 && (
            <Section title={t("reports.bookings.cancelReasons")}>
              <DistributionBars
                items={data.byCancelReason.map((c) => ({
                  key: c.reason,
                  label: t(`reports.cancelReason.${c.reason}`),
                  value: c.count,
                }))}
              />
            </Section>
          )}

          {data.noShowRate > 0.1 && (
            <InsightBanner tone="warning">
              <span className="inline-flex items-center gap-2">
                <HugeiconsIcon icon={Alert01Icon} size={16} />
                {t("reports.bookings.insightNoShowHigh")}
              </span>
            </InsightBanner>
          )}
        </>
      )}
    </ReportPageShell>
  )
}
