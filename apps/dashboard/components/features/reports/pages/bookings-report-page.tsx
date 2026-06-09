"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { Skeleton } from "@sawaa/ui"
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
  COMPLETED: "#15803D",
  CONFIRMED: "#14a89a",
  PENDING: "#94A3B8",
  CANCELLED: "#C2410C",
  NO_SHOW: "#DC2626",
  EXPIRED: "#94A3B8",
  AWAITING_PAYMENT: "#C2410C",
}

const TYPE_COLORS: Record<string, string> = {
  INDIVIDUAL: "#14a89a",
  GROUP: "#ef7a6b",
  WALK_IN: "#F59E0B",
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
                  color: STATUS_COLORS[s.status] ?? "#94A3B8",
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
                  color: TYPE_COLORS[tp.type] ?? "#94A3B8",
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
              ⚠️ {t("reports.bookings.insightNoShowHigh")}
            </InsightBanner>
          )}
        </>
      )}
    </ReportPageShell>
  )
}
