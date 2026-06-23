"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { ErrorBanner } from "@/components/features/error-banner"
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
import { ReportTable } from "../report-table"

const METHOD_COLORS: Record<string, string> = {
  ONLINE_CARD: "var(--chart-1)",
  BANK_TRANSFER: "var(--chart-2)",
  CASH: "var(--muted-foreground)",
  COUPON: "var(--chart-3)",
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "var(--success)",
  PENDING: "var(--warning)",
  PENDING_VERIFICATION: "var(--warning)",
  FAILED: "var(--error)",
  REFUNDED: "var(--refunded)",
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.reports.revenue(params),
    queryFn: () => fetchRevenueReport(params),
    enabled: !!params.dateFrom && !!params.dateTo,
  })
  const errMsg = error instanceof Error ? t("error.server") : t("error.unexpected")

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
      ) : error ? (
        <ErrorBanner message={errMsg} onRetry={() => refetch()} />
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
                    color: "var(--chart-1)",
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
                  color: METHOD_COLORS[m.method] ?? "var(--muted-foreground)",
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
                  color: STATUS_COLORS[s.status] ?? "var(--muted-foreground)",
                }))}
              />
            </Section>
          </div>

          {data.couponsUsed.length > 0 && (
            <Section title={t("reports.financial.couponsUsed")}>
              <ReportTable
                columns={[
                  {
                    key: "code",
                    header: t("reports.financial.couponCode"),
                    render: (c) => <span className="font-medium">{c.code}</span>,
                  },
                  {
                    key: "uses",
                    header: t("reports.financial.couponUses"),
                    render: (c) => <span className="tabular-nums">{c.uses}</span>,
                  },
                  {
                    key: "discount",
                    header: t("reports.financial.couponDiscount"),
                    render: (c) => (
                      <span className="tabular-nums">
                        <FormattedCurrency amount={c.discountAmount} locale={locale} />
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: t("reports.status"),
                    render: (c) =>
                      c.isActive ? (
                        <span className="rounded-sm bg-success/15 px-2 py-0.5 text-xs text-success">
                          {t("reports.financial.couponActive")}
                        </span>
                      ) : (
                        <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {t("reports.financial.couponExpired")}
                        </span>
                      ),
                  },
                ]}
                rows={data.couponsUsed}
                getRowKey={(c) => c.code}
              />
            </Section>
          )}

          {data.recentPayments.length > 0 && (
            <Section title={t("reports.financial.recentPayments")}>
              <ReportTable
                columns={[
                  {
                    key: "date",
                    header: t("reports.date"),
                    render: (p) => (
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.date).toLocaleDateString(locale)}
                      </span>
                    ),
                  },
                  {
                    key: "client",
                    header: t("reports.client"),
                    render: (p) => p.clientName || "—",
                  },
                  {
                    key: "service",
                    header: t("reports.service"),
                    render: (p) => p.serviceName || "—",
                  },
                  {
                    key: "method",
                    header: t("reports.method"),
                    render: (p) => (
                      <span className="text-xs">{t(`reports.paymentMethod.${p.method}`)}</span>
                    ),
                  },
                  {
                    key: "amount",
                    header: t("reports.amount"),
                    render: (p) => (
                      <span className="tabular-nums">
                        <FormattedCurrency amount={p.amount} locale={locale} />
                      </span>
                    ),
                  },
                ]}
                rows={data.recentPayments}
                getRowKey={(p) => p.id}
              />
            </Section>
          )}
        </>
      )}
    </ReportPageShell>
  )
}
