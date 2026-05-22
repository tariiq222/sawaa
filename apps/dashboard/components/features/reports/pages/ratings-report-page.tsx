"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { Skeleton } from "@sawaa/ui"
import { queryKeys } from "@/lib/query-keys"
import { fetchRatingsReport } from "@/lib/api/reports"
import { ReportPageShell } from "../report-page-shell"
import { KpiRow } from "../kpi-row"
import { KpiCard } from "../kpi-card"
import { Section } from "../section"
import { DistributionBars } from "../distribution-bars"
import { TrendChart } from "../trend-chart"
import { ReportsEmptyState } from "../empty-state"
import { useReportsPeriodCtx } from "../reports-period-context"
import { computeDelta } from "../delta-helpers"

const STAR_COLORS: Record<number, string> = {
  5: "#166534",
  4: "#14a89a",
  3: "#F59E0B",
  2: "#B45309",
  1: "#B91C1C",
}

export function RatingsReportPage() {
  const { t, locale } = useLocale()
  const period = useReportsPeriodCtx()
  const params = {
    dateFrom: period.normalizedFrom,
    dateTo: period.apiDateTo,
    branchId: period.branchId,
    compareWithPrevious: true,
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.ratings(params),
    queryFn: () => fetchRatingsReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })

  const positiveRate = data && data.totalRatings > 0
    ? (data.positiveCount / data.totalRatings) * 100
    : 0
  const negativeRate = data && data.totalRatings > 0
    ? (data.negativeCount / data.totalRatings) * 100
    : 0

  return (
    <ReportPageShell
      title={t("reports.ratings.title")}
      description={t("reports.ratings.description")}
      exportType="RATINGS"
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
              label={t("reports.ratings.average")}
              value={`${data.averageScore.toFixed(1)} / 5`}
              delta={computeDelta(data.averageScore, data.previous?.averageScore)}
            />
            <KpiCard
              label={t("reports.ratings.totalRatings")}
              value={data.totalRatings.toLocaleString(locale)}
              delta={computeDelta(
                data.totalRatings,
                data.previous?.totalRatings,
                { format: "count" },
              )}
            />
            <KpiCard
              label={t("reports.ratings.positiveRate")}
              value={`${positiveRate.toFixed(0)}٪`}
            />
            <KpiCard
              label={t("reports.ratings.negativeRate")}
              value={`${negativeRate.toFixed(0)}٪`}
            />
          </KpiRow>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title={t("reports.ratings.distribution")}>
              <DistributionBars
                items={data.distribution
                  .sort((a, b) => b.score - a.score)
                  .map((d) => ({
                    key: String(d.score),
                    label: (
                      <span>
                        {"★".repeat(d.score)}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({d.score})
                        </span>
                      </span>
                    ),
                    value: d.count,
                    color: STAR_COLORS[d.score],
                  }))}
                total={data.totalRatings}
              />
            </Section>

            {data.trend.length > 0 && (
              <Section title={t("reports.ratings.trend")}>
                <TrendChart
                  data={data.trend.map((d) => ({
                    date: d.date,
                    average: d.average,
                  }))}
                  series={[
                    {
                      key: "average",
                      label: t("reports.ratings.averageSeries"),
                      color: "#F59E0B",
                      type: "line",
                    },
                  ]}
                />
              </Section>
            )}
          </div>

          {data.recentNegative.length > 0 && (
            <Section
              title={t("reports.ratings.recentNegative")}
              subtitle={t("reports.ratings.recentNegativeSubtitle")}
            >
              <div className="space-y-3">
                {data.recentNegative.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border bg-surface-muted p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {r.clientName || "—"} · {r.serviceName || "—"}
                      </span>
                      <span className="text-xs text-warning">
                        {"★".repeat(r.score)}
                        {"☆".repeat(5 - r.score)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.employeeName} · {new Date(r.createdAt).toLocaleDateString(locale)}
                    </p>
                    {r.comment && (
                      <p className="mt-2 text-sm text-foreground">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </ReportPageShell>
  )
}
