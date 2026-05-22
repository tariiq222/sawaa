"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
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

const GENDER_COLORS: Record<string, string> = {
  MALE: "#14a89a",
  FEMALE: "#ef7a6b",
  UNKNOWN: "#94A3B8",
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

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.clients(params),
    queryFn: () => fetchClientsReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })

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
                  color: GENDER_COLORS[g.gender] ?? "#94A3B8",
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.client")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.clients.bookings")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.clients.revenue")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topByRevenue.map((c) => (
                      <tr key={c.clientId} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 font-medium">{c.name || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{c.bookings}</td>
                        <td className="px-3 py-2 tabular-nums">
                          <FormattedCurrency amount={c.revenue} locale={locale} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}
    </ReportPageShell>
  )
}
