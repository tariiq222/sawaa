"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Skeleton } from "@sawaa/ui"
import { queryKeys } from "@/lib/query-keys"
import { fetchRevenueReport } from "@/lib/api/reports"
import { ReportPageShell } from "../report-page-shell"
import { KpiRow } from "../kpi-row"
import { KpiCard } from "../kpi-card"
import { Section } from "../section"
import { TrendChart } from "../trend-chart"
import { DonutList } from "../donut-list"
import { DistributionBars } from "../distribution-bars"
import { ReportsEmptyState } from "../empty-state"
import { useReportsPeriodCtx } from "../reports-period-context"
import { computeDelta } from "../delta-helpers"

const METHOD_COLORS: Record<string, string> = {
  ONLINE_CARD: "#14a89a",
  BANK_TRANSFER: "#F59E0B",
  CASH: "#94A3B8",
  COUPON: "#ef7a6b",
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "#15803D",
  PENDING: "#C2410C",
  PENDING_VERIFICATION: "#C2410C",
  FAILED: "#DC2626",
  REFUNDED: "#94A3B8",
}

export function FinancialReportPage() {
  const { t, locale } = useLocale()
  const period = useReportsPeriodCtx()
  const params = {
    dateFrom: period.normalizedFrom,
    dateTo: period.apiDateTo,
    branchId: period.branchId,
    compareWithPrevious: true,
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.revenue(params),
    queryFn: () => fetchRevenueReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })

  return (
    <ReportPageShell
      title={t("reports.financial.title")}
      description={t("reports.financial.description")}
      exportType="REVENUE"
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
              label={t("reports.financial.totalRevenue")}
              value={<FormattedCurrency amount={data.totalRevenue} locale={locale} />}
              delta={computeDelta(data.totalRevenue, data.previous?.totalRevenue)}
            />
            <KpiCard
              label={t("reports.financial.netRevenue")}
              value={<FormattedCurrency amount={data.netRevenue} locale={locale} />}
              delta={computeDelta(data.netRevenue, data.previous?.netRevenue)}
            />
            <KpiCard
              label={t("reports.financial.avgPerBooking")}
              value={<FormattedCurrency amount={data.averagePerBooking} locale={locale} />}
              delta={computeDelta(
                data.averagePerBooking,
                data.previous?.averagePerBooking,
              )}
            />
            <KpiCard
              label={t("reports.financial.refunds")}
              value={<FormattedCurrency amount={data.refundsTotal} locale={locale} />}
              delta={computeDelta(
                data.refundsTotal,
                data.previous?.refundsTotal,
                { inverse: true },
              )}
            />
          </KpiRow>

          {data.byDay.length > 0 && (
            <Section title={t("reports.financial.revenueTrend")}>
              <TrendChart
                data={data.byDay.map((d) => ({
                  date: d.date,
                  revenue: d.amount,
                }))}
                series={[
                  {
                    key: "revenue",
                    label: t("reports.financial.revenueSeries"),
                    color: "#14a89a",
                    type: "area",
                  },
                ]}
                previous={data.previous?.byDay.map((d) => ({
                  date: d.date,
                  revenue: d.amount,
                }))}
              />
            </Section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Section title={t("reports.financial.byMethod")}>
              <DonutList
                items={data.byMethod.map((m) => ({
                  key: m.method,
                  label: t(`reports.paymentMethod.${m.method}`),
                  value: m.count,
                  color: METHOD_COLORS[m.method] ?? "#94A3B8",
                  amount: (
                    <FormattedCurrency amount={m.amount} locale={locale} />
                  ),
                }))}
                centerLabel={t("reports.payments")}
                centerValue={data.byMethod.reduce((s, m) => s + m.count, 0)}
              />
            </Section>

            <Section title={t("reports.financial.byStatus")}>
              <DistributionBars
                items={data.byStatus.map((s) => ({
                  key: s.status,
                  label: t(`reports.paymentStatus.${s.status}`),
                  value: s.amount,
                  display: (
                    <FormattedCurrency amount={s.amount} locale={locale} />
                  ),
                  color: STATUS_COLORS[s.status] ?? "#94A3B8",
                }))}
              />
            </Section>
          </div>

          {data.couponsUsed.length > 0 && (
            <Section title={t("reports.financial.couponsUsed")}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.financial.couponCode")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.financial.couponUses")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.financial.couponDiscount")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.couponsUsed.map((c) => (
                      <tr key={c.code} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 font-medium">{c.code}</td>
                        <td className="px-3 py-2 tabular-nums">{c.uses}</td>
                        <td className="px-3 py-2 tabular-nums">
                          <FormattedCurrency amount={c.discountAmount} locale={locale} />
                        </td>
                        <td className="px-3 py-2">
                          {c.isActive ? (
                            <span className="rounded-sm bg-success/15 px-2 py-0.5 text-xs text-success">
                              {t("reports.financial.couponActive")}
                            </span>
                          ) : (
                            <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {t("reports.financial.couponExpired")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {data.recentPayments.length > 0 && (
            <Section title={t("reports.financial.recentPayments")}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.date")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.client")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.service")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.method")}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t("reports.amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPayments.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(p.date).toLocaleDateString(locale)}
                        </td>
                        <td className="px-3 py-2">{p.clientName || "—"}</td>
                        <td className="px-3 py-2">{p.serviceName || "—"}</td>
                        <td className="px-3 py-2 text-xs">
                          {t(`reports.paymentMethod.${p.method}`)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          <FormattedCurrency amount={p.amount} locale={locale} />
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
