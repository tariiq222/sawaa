"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Skeleton } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { queryKeys } from "@/lib/query-keys"
import { fetchOverviewReport } from "@/lib/api/reports"
import { ReportPageShell } from "../report-page-shell"
import { KpiRow } from "../kpi-row"
import { KpiCard } from "../kpi-card"
import { Section } from "../section"
import { TrendChart } from "../trend-chart"
import { DistributionBars } from "../distribution-bars"
import { InsightBanner } from "../insight-banner"
import { ReportsEmptyState } from "../empty-state"
import { useReportsPeriodCtx } from "../reports-period-context"
import { computeDelta } from "../delta-helpers"

export function OverviewReportPage() {
  const { t, locale } = useLocale()
  const period = useReportsPeriodCtx()
  const params = {
    dateFrom: period.normalizedFrom,
    dateTo: period.apiDateTo,
    branchId: period.branchId,
    compareWithPrevious: true,
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.overview(params),
    queryFn: () => fetchOverviewReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })

  return (
    <ReportPageShell
      title={t("reports.overview.title")}
      description={t("reports.overview.description")}
      exportType="OVERVIEW"
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
              label={t("reports.overview.totalRevenue")}
              value={<FormattedCurrency amount={data.totalRevenue} locale={locale} />}
              delta={computeDelta(data.totalRevenue, data.previous?.totalRevenue)}
            />
            <KpiCard
              label={t("reports.overview.totalBookings")}
              value={data.totalBookings.toLocaleString(locale)}
              delta={computeDelta(
                data.totalBookings,
                data.previous?.totalBookings,
                { format: "count" },
              )}
            />
            <KpiCard
              label={t("reports.overview.completionRate")}
              value={`${Math.round(data.completionRate * 100)}٪`}
              delta={computeDelta(
                data.completionRate,
                data.previous?.completionRate,
              )}
            />
            <KpiCard
              label={t("reports.overview.newClients")}
              value={data.newClients.toLocaleString(locale)}
              delta={computeDelta(
                data.newClients,
                data.previous?.newClients,
                { format: "count" },
              )}
            />
          </KpiRow>

          {data.trend.length > 0 && (
            <Section
              title={t("reports.overview.trendTitle")}
              subtitle={t("reports.overview.trendSubtitle")}
            >
              <TrendChart
                data={data.trend.map((d) => ({
                  date: d.date,
                  revenue: d.revenue,
                  bookings: d.bookings,
                }))}
                series={[
                  {
                    key: "revenue",
                    label: t("reports.overview.revenueSeries"),
                    color: "var(--chart-1)",
                    type: "area",
                  },
                  {
                    key: "bookings",
                    label: t("reports.overview.bookingsSeries"),
                    color: "var(--chart-3)",
                    type: "line",
                  },
                ]}
                previous={data.previous?.trend.map((d) => ({
                  date: d.date,
                  revenue: d.revenue,
                  bookings: d.bookings,
                }))}
              />
            </Section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Section title={t("reports.overview.topServices")}>
              {data.topServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <DistributionBars
                  items={data.topServices.map((s) => ({
                    key: s.serviceId,
                    label: s.nameAr || s.nameEn || s.serviceId,
                    value: s.count,
                    display: s.count,
                  }))}
                  showPercentage={false}
                />
              )}
            </Section>

            <Section title={t("reports.overview.topPractitioners")}>
              {data.topPractitioners.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <div className="space-y-3">
                  {data.topPractitioners.map((p) => (
                    <div
                      key={p.employeeId}
                      className="flex items-center justify-between border-b border-border pb-2 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.bookings} {t("reports.bookings")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        <FormattedCurrency amount={p.revenue} locale={locale} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {data.previous && data.totalRevenue > data.previous.totalRevenue && (
            <InsightBanner>
              <span className="inline-flex items-center gap-2">
                <HugeiconsIcon icon={InformationCircleIcon} size={16} />
                {t("reports.overview.insightRevenueUp")}{" "}
                <FormattedCurrency amount={data.totalRevenue - data.previous.totalRevenue} locale={locale} />
              </span>
            </InsightBanner>
          )}
        </>
      )}
    </ReportPageShell>
  )
}
