"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Input, Skeleton } from "@sawaa/ui"
import { cn } from "@/lib/utils"
import { queryKeys } from "@/lib/query-keys"
import { fetchPractitionersReport } from "@/lib/api/reports"
import { ReportPageShell } from "../report-page-shell"
import { KpiRow } from "../kpi-row"
import { KpiCard } from "../kpi-card"
import { Section } from "../section"
import { DistributionBars } from "../distribution-bars"
import { ReportsEmptyState } from "../empty-state"
import { useReportsPeriodCtx } from "../reports-period-context"
import { computeDelta } from "../delta-helpers"
import { ReportTable } from "../report-table"

export function PractitionersReportPage() {
  const { t, locale } = useLocale()
  const period = useReportsPeriodCtx()
  const [search, setSearch] = useState("")
  const params = {
    dateFrom: period.normalizedFrom,
    dateTo: period.apiDateTo,
    branchId: period.branchId,
    compareWithPrevious: true,
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.practitioners(params),
    queryFn: () => fetchPractitionersReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })

  const filtered = data?.rows.filter((r) =>
    search ? r.name.toLowerCase().includes(search.toLowerCase()) : true,
  )

  return (
    <ReportPageShell
      title={t("reports.practitioners.title")}
      description={t("reports.practitioners.description")}
      exportType="EMPLOYEES"
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
              label={t("reports.practitioners.active")}
              value={data.totalActive.toLocaleString(locale)}
              delta={computeDelta(
                data.totalActive,
                data.previous?.totalActive,
                { format: "count" },
              )}
            />
            <KpiCard
              label={t("reports.practitioners.totalCompleted")}
              value={data.totalCompleted.toLocaleString(locale)}
              delta={computeDelta(
                data.totalCompleted,
                data.previous?.totalCompleted,
                { format: "count" },
              )}
            />
            <KpiCard
              label={t("reports.practitioners.avgRevenue")}
              value={<FormattedCurrency amount={data.avgRevenue} locale={locale} />}
              delta={computeDelta(data.avgRevenue, data.previous?.avgRevenue)}
            />
            <KpiCard
              label={t("reports.practitioners.avgRating")}
              value={`${data.avgRating.toFixed(1)} / 5`}
            />
          </KpiRow>

          {data.rows.length > 0 && (
            <Section title={t("reports.practitioners.revenueComparison")}>
              <DistributionBars
                items={data.rows.slice(0, 10).map((r) => ({
                  key: r.employeeId,
                  label: (
                    <span>
                      <span className="font-medium text-foreground">{r.name}</span>
                      {r.role && (
                        <span className="text-xs text-muted-foreground"> · {r.role}</span>
                      )}
                    </span>
                  ),
                  value: r.revenue,
                  display: <FormattedCurrency amount={r.revenue} locale={locale} />,
                }))}
                showPercentage={false}
              />
            </Section>
          )}

          <Section
            title={t("reports.practitioners.fullTable")}
            actions={
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("reports.practitioners.searchPlaceholder")}
                className="h-8 w-48 text-sm"
                data-testid="practitioners-search"
              />
            }
          >
            <ReportTable
              columns={[
                {
                  key: "name",
                  header: t("reports.practitioners.name"),
                  render: (r) => (
                    <div>
                      <div className="font-medium">{r.name}</div>
                      {r.role && (
                        <div className="text-xs text-muted-foreground">{r.role}</div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "bookings",
                  header: t("reports.practitioners.bookings"),
                  render: (r) => <span className="tabular-nums">{r.bookings}</span>,
                },
                {
                  key: "completed",
                  header: t("reports.practitioners.completed"),
                  render: (r) => (
                    <span className="tabular-nums font-medium">{r.completedBookings}</span>
                  ),
                },
                {
                  key: "completion",
                  header: t("reports.practitioners.completion"),
                  render: (r) => (
                    <span
                      className={cn(
                        "rounded-sm px-2 py-0.5 text-xs",
                        r.completionRate >= 0.85
                          ? "bg-success/15 text-success"
                          : "bg-warning/15 text-warning",
                      )}
                    >
                      {(r.completionRate * 100).toFixed(0)}٪
                    </span>
                  ),
                },
                {
                  key: "revenue",
                  header: t("reports.practitioners.revenue"),
                  render: (r) => (
                    <span className="tabular-nums font-medium">
                      <FormattedCurrency amount={r.revenue} locale={locale} />
                    </span>
                  ),
                },
                {
                  key: "utilization",
                  header: t("reports.practitioners.utilization"),
                  render: (r) => (
                    <span className="tabular-nums">{(r.utilization * 100).toFixed(0)}٪</span>
                  ),
                },
                {
                  key: "rating",
                  header: t("reports.practitioners.rating"),
                  render: (r) => (
                    <span className="tabular-nums">
                      {r.averageRating > 0 ? `★ ${r.averageRating.toFixed(1)}` : "—"}
                    </span>
                  ),
                },
              ]}
              rows={filtered ?? []}
              getRowKey={(r) => r.employeeId}
            />
          </Section>
        </>
      )}
    </ReportPageShell>
  )
}
