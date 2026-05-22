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

export function ServicesReportPage() {
  const { t, locale } = useLocale()
  const period = useReportsPeriodCtx()
  const params = {
    dateFrom: period.normalizedFrom,
    dateTo: period.apiDateTo,
    branchId: period.branchId,
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
            />
            <KpiCard
              label={t("reports.services.totalBookings")}
              value={totalBookings.toLocaleString(locale)}
            />
            <KpiCard
              label={t("reports.services.totalRevenue")}
              value={<FormattedCurrency amount={totalRevenue} locale={locale} />}
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
            {data.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.services.service")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.services.bookings")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.services.completed")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.services.revenue")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.services.cancelRate")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.services.rating")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.serviceId} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 font-medium">
                          {r.nameAr || r.nameEn || r.serviceId}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{r.bookings}</td>
                        <td className="px-3 py-2 tabular-nums font-medium">{r.completedBookings}</td>
                        <td className="px-3 py-2 tabular-nums">
                          <FormattedCurrency amount={r.revenue} locale={locale} />
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {(r.cancelRate * 100).toFixed(0)}٪
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {r.averageRating > 0 ? `★ ${r.averageRating.toFixed(1)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </ReportPageShell>
  )
}
