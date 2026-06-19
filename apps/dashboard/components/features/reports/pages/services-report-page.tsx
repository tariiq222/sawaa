"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Skeleton } from "@sawaa/ui"
import { queryKeys } from "@/lib/query-keys"
import { fetchServicesReport } from "@/lib/api/reports"
import { ReportPageShell } from "../report-page-shell"
import { KpiRow } from "../kpi-row"
import { KpiCard } from "../kpi-card"
import { Section } from "../section"
import { DistributionBars } from "../distribution-bars"
import { ReportsEmptyState } from "../empty-state"
import { useReportsPeriodCtx } from "../reports-period-context"
import { computeDelta } from "../delta-helpers"
import { ReportTable } from "../report-table"

export function ServicesReportPage() {
  const { t, locale } = useLocale()
  const period = useReportsPeriodCtx()
  const params = {
    dateFrom: period.normalizedFrom,
    dateTo: period.apiDateTo,
    branchId: period.branchId,
    compareWithPrevious: true,
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.services(params),
    queryFn: () => fetchServicesReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })

  const totalBookings = data?.rows.reduce((s, r) => s + r.bookings, 0) ?? 0
  const totalRevenue = data?.rows.reduce((s, r) => s + r.revenue, 0) ?? 0
  const ratedRows = data?.rows.filter((r) => r.averageRating > 0) ?? []
  const avgRating =
    ratedRows.length > 0
      ? ratedRows.reduce((s, r) => s + r.averageRating, 0) / ratedRows.length
      : 0

  return (
    <ReportPageShell
      title={t("reports.services.title")}
      description={t("reports.services.description")}
      exportType="SERVICES"
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
              label={t("reports.services.totalServices")}
              value={data.rows.length.toLocaleString(locale)}
              delta={computeDelta(data.rows.length, data.previous?.rows?.length, { format: "count" })}
            />
            <KpiCard
              label={t("reports.services.totalBookings")}
              value={totalBookings.toLocaleString(locale)}
              delta={computeDelta(totalBookings, data.previous?.rows?.reduce((s: number, r: { bookings: number }) => s + r.bookings, 0), { format: "count" })}
            />
            <KpiCard
              label={t("reports.services.totalRevenue")}
              value={<FormattedCurrency amount={totalRevenue} locale={locale} />}
              delta={computeDelta(totalRevenue, data.previous?.rows?.reduce((s: number, r: { revenue: number }) => s + r.revenue, 0))}
            />
            <KpiCard
              label={t("reports.services.avgRating")}
              value={avgRating > 0 ? `${avgRating.toFixed(1)} / 5` : "—"}
            />
          </KpiRow>

          {data.rows.length > 0 && (
            <Section title={t("reports.services.topByRevenue")}>
              <DistributionBars
                items={[...data.rows]
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 10)
                  .map((s) => ({
                    key: s.serviceId,
                    label: s.nameAr || s.nameEn || s.serviceId,
                    value: s.revenue,
                    display: <FormattedCurrency amount={s.revenue} locale={locale} />,
                  }))}
                showPercentage={false}
              />
            </Section>
          )}

          <Section title={t("reports.services.fullTable")}>
            <ReportTable
              columns={[
                {
                  key: "service",
                  header: t("reports.services.service"),
                  render: (r) => (
                    <span className="font-medium">{r.nameAr || r.nameEn || r.serviceId}</span>
                  ),
                },
                {
                  key: "bookings",
                  header: t("reports.services.bookings"),
                  render: (r) => <span className="tabular-nums">{r.bookings}</span>,
                },
                {
                  key: "completed",
                  header: t("reports.services.completed"),
                  render: (r) => (
                    <span className="tabular-nums font-medium">{r.completedBookings}</span>
                  ),
                },
                {
                  key: "revenue",
                  header: t("reports.services.revenue"),
                  render: (r) => (
                    <span className="tabular-nums">
                      <FormattedCurrency amount={r.revenue} locale={locale} />
                    </span>
                  ),
                },
                {
                  key: "cancelRate",
                  header: t("reports.services.cancelRate"),
                  render: (r) => (
                    <span className="tabular-nums">{(r.cancelRate * 100).toFixed(0)}٪</span>
                  ),
                },
                {
                  key: "rating",
                  header: t("reports.services.rating"),
                  render: (r) => (
                    <span className="tabular-nums">
                      {r.averageRating > 0 ? `★ ${r.averageRating.toFixed(1)}` : "—"}
                    </span>
                  ),
                },
              ]}
              rows={data.rows}
              getRowKey={(r) => r.serviceId}
            />
          </Section>
        </>
      )}
    </ReportPageShell>
  )
}
