"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { ErrorBanner } from "@/components/features/error-banner"
import { Skeleton } from "@sawaa/ui"
import { queryKeys } from "@/lib/query-keys"
import { fetchClientsReport } from "@/lib/api/reports"
import { ReportPageShell } from "../report-page-shell"
import { KpiRow } from "../kpi-row"
import { KpiCard } from "../kpi-card"
import { Section } from "../section"
import { DonutList } from "../donut-list"
import { DistributionBars } from "../distribution-bars"
import { ReportsEmptyState } from "../empty-state"
import { useReportsPeriodCtx } from "../reports-period-context"
import { computeDelta } from "../delta-helpers"
import { ReportTable } from "../report-table"

const GENDER_COLORS: Record<string, string> = {
  MALE: "var(--chart-1)",
  FEMALE: "var(--chart-5)",
  UNKNOWN: "var(--muted-foreground)",
}

export function ClientsReportPage() {
  const { t, locale } = useLocale()
  const period = useReportsPeriodCtx()
  const params = {
    dateFrom: period.normalizedFrom,
    dateTo: period.apiDateTo,
    branchId: period.branchId,
    compareWithPrevious: true,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.reports.clients(params),
    queryFn: () => fetchClientsReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })
  const errMsg = error instanceof Error ? t("error.server") : t("error.unexpected")

  return (
    <ReportPageShell
      title={t("reports.clients.title")}
      description={t("reports.clients.description")}
      exportType="CLIENTS"
    >
      {isLoading ? (
        <KpiRow>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </KpiRow>
      ) : error ? (
        <ErrorBanner message={errMsg} onRetry={() => refetch()} />
      ) : !data ? (
        <ReportsEmptyState />
      ) : (
        <>
          <KpiRow>
            <KpiCard
              label={t("reports.clients.totalActive")}
              value={data.total.toLocaleString(locale)}
              delta={computeDelta(data.total, data.previous?.total, { format: "count" })}
            />
            <KpiCard
              label={t("reports.clients.new")}
              value={data.newClients.toLocaleString(locale)}
              delta={computeDelta(
                data.newClients,
                data.previous?.newClients,
                { format: "count" },
              )}
            />
            <KpiCard
              label={t("reports.clients.returning")}
              value={data.returningClients.toLocaleString(locale)}
              delta={computeDelta(
                data.returningClients,
                data.previous?.returningClients,
                { format: "count" },
              )}
            />
            <KpiCard
              label={t("reports.clients.retention")}
              value={`${(data.retentionRate * 100).toFixed(0)}٪`}
              delta={computeDelta(data.retentionRate, data.previous?.retentionRate)}
            />
          </KpiRow>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title={t("reports.clients.byGender")}>
              <DonutList
                items={data.byGender.map((g) => ({
                  key: g.gender,
                  label: t(`reports.gender.${g.gender}`),
                  value: g.count,
                  color: GENDER_COLORS[g.gender] ?? "var(--muted-foreground)",
                  amount: g.count,
                }))}
                centerLabel={t("reports.clients.clientsLabel")}
                centerValue={data.total}
              />
            </Section>
            <Section title={t("reports.clients.byAgeGroup")}>
              <DistributionBars
                items={data.byAgeGroup.map((g) => ({
                  key: g.group,
                  label: t(`reports.ageGroup.${g.group}`),
                  value: g.count,
                }))}
              />
            </Section>
          </div>

          {data.topByRevenue.length > 0 && (
            <Section title={t("reports.clients.topByRevenue")}>
              <ReportTable
                columns={[
                  {
                    key: "client",
                    header: t("reports.client"),
                    render: (c) => <span className="font-medium">{c.name || "—"}</span>,
                  },
                  {
                    key: "bookings",
                    header: t("reports.clients.bookings"),
                    render: (c) => <span className="tabular-nums">{c.bookings}</span>,
                  },
                  {
                    key: "revenue",
                    header: t("reports.clients.revenue"),
                    render: (c) => (
                      <span className="tabular-nums">
                        <FormattedCurrency amount={c.revenue} locale={locale} />
                      </span>
                    ),
                  },
                ]}
                rows={data.topByRevenue}
                getRowKey={(c) => c.clientId}
              />
            </Section>
          )}
        </>
      )}
    </ReportPageShell>
  )
}
