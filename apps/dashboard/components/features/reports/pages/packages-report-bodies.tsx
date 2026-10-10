"use client"

// The refund renderer lives in `refunded-package-report.tsx` because its
// EVENTS/LEGACY branches have distinct table contracts. The remaining report
// bodies stay together to share the existing report-part plumbing.

/**
 * Package Report Bodies — Sawaa Dashboard
 *
 * Sibling file of `packages-report-page.tsx` that owns the four
 * per-report body renderers. Lives in a sibling so the page itself
 * stays under the 300-line feature-component rule.
 *
 * Each renderer takes the discriminated `PackageReport` for its
 * `kind` and renders `KpiRow` / `KpiCard` / `Section` / `ReportTable`
 * / `ReportsEmptyState` from the existing report-parts folder. They
 * share enough `FormattedCurrency` + locale plumbing that extracting
 * further (per-report files) would create more noise than savings.
 */

import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { KpiRow } from "@/components/features/reports/kpi-row"
import { KpiCard } from "@/components/features/reports/kpi-card"
import { Section } from "@/components/features/reports/section"
import { ReportTable } from "@/components/features/reports/report-table"
import { ReportsEmptyState } from "@/components/features/reports/empty-state"
import { RefundedPackageReport } from "./refunded-package-report"
import type { PackageReport } from "@/lib/types/package-report"

/* ─── Body dispatcher ─── */

export function PackageReportBody({ report }: { report: PackageReport }) {
  const { t, locale } = useLocale()
  switch (report.kind) {
    case "SALES":
      return <SalesReport report={report} locale={locale} t={t} />
    case "OUTSTANDING_CREDIT":
      return <OutstandingReport report={report} locale={locale} t={t} />
    case "CONSUMPTION":
      return <ConsumptionReport report={report} t={t} />
    case "REFUNDED":
      return <RefundedPackageReport report={report} locale={locale} t={t} />
  }
}

/* ─── SALES ─── */

function SalesReport({
  report,
  locale,
  t,
}: {
  report: Extract<PackageReport, { kind: "SALES" }>
  locale: "ar" | "en"
  t: (key: string) => string
}) {
  return (
    <>
      <KpiRow>
        <KpiCard
          label={t("reports.packages.sales.purchaseCount")}
          value={<span className="tabular-nums">{report.purchaseCount}</span>}
        />
        <KpiCard
          label={t("reports.packages.sales.grossRevenue")}
          value={
            <FormattedCurrency amount={report.grossRevenue} locale={locale} />
          }
        />
        <KpiCard
          label={t("reports.packages.sales.refundedAmount")}
          value={
            <FormattedCurrency amount={report.refundedAmount} locale={locale} />
          }
        />
        <KpiCard
          label={t("reports.packages.sales.netRevenue")}
          value={
            <FormattedCurrency amount={report.netRevenue} locale={locale} />
          }
        />
      </KpiRow>
      <KpiRow className="lg:grid-cols-3">
        <KpiCard
          label={t("reports.packages.sales.byBucket.cash")}
          value={
            <FormattedCurrency amount={report.byBucket.cash} locale={locale} />
          }
        />
        <KpiCard
          label={t("reports.packages.sales.byBucket.network")}
          value={
            <FormattedCurrency
              amount={report.byBucket.network}
              locale={locale}
            />
          }
        />
        <KpiCard
          label={t("reports.packages.sales.byBucket.electronic")}
          value={
            <FormattedCurrency
              amount={report.byBucket.electronic}
              locale={locale}
            />
          }
        />
      </KpiRow>

      <p className="text-xs text-muted-foreground">
        {t("reports.packages.sales.refundCohortNote")}
      </p>

      {report.byMethod.length > 0 && (
        <Section title={t("reports.packages.sales.byMethod")}>
          <ReportTable
            columns={[
              {
                key: "method",
                header: t("reports.method"),
                render: (m) => (
                  <span className="text-xs">
                    {t(`reports.paymentMethod.${m.method}`) || m.method}
                  </span>
                ),
              },
              {
                key: "count",
                header: t("reports.packages.sales.count"),
                render: (m) => <span className="tabular-nums">{m.count}</span>,
              },
              {
                key: "amount",
                header: t("reports.amount"),
                render: (m) => (
                  <span className="tabular-nums">
                    <FormattedCurrency amount={m.amount} locale={locale} />
                  </span>
                ),
              },
            ]}
            rows={report.byMethod}
            getRowKey={(m) => m.method}
          />
        </Section>
      )}
    </>
  )
}

/* ─── OUTSTANDING_CREDIT ─── */

function OutstandingReport({
  report,
  locale,
  t,
}: {
  report: Extract<PackageReport, { kind: "OUTSTANDING_CREDIT" }>
  locale: "ar" | "en"
  t: (key: string) => string
}) {
  return (
    <KpiRow>
      <KpiCard
        label={t("reports.packages.outstanding.liability")}
        value={
          <FormattedCurrency
            amount={report.outstandingLiability}
            locale={locale}
          />
        }
      />
      <KpiCard
        label={t("reports.packages.outstanding.sessions")}
        value={
          <span className="tabular-nums">{report.outstandingSessions}</span>
        }
      />
      <KpiCard
        label={t("reports.packages.outstanding.creditCount")}
        value={<span className="tabular-nums">{report.creditCount}</span>}
      />
      <KpiCard
        label={t("reports.packages.outstanding.reservedSessions")}
        value={<span className="tabular-nums">{report.reservedSessions}</span>}
      />
    </KpiRow>
  )
}

/* ─── CONSUMPTION ─── */

function ConsumptionReport({
  report,
  t,
}: {
  report: Extract<PackageReport, { kind: "CONSUMPTION" }>
  t: (key: string) => string
}) {
  if (report.byEmployee.length === 0) {
    return <ReportsEmptyState />
  }
  return (
    <>
      <KpiRow>
        <KpiCard
          label={t("reports.packages.consumption.totalConsumed")}
          value={<span className="tabular-nums">{report.totalConsumed}</span>}
        />
      </KpiRow>
      <Section title={t("reports.packages.consumption.byEmployee")}>
        <ReportTable
          columns={[
            {
              key: "name",
              header: t("reports.practitioners.name"),
              render: (row) => (
                <span className="flex flex-col gap-1">
                  <span className="font-medium">
                    {row.employeeId === "unknown"
                      ? t("reports.packages.consumption.unknownPractitioner")
                      : row.name}
                  </span>
                  {row.attribution && row.attribution !== "BOOKING" && (
                    <span className="text-xs text-muted-foreground">
                      {t(
                        `reports.packages.consumption.attribution.${row.attribution}`
                      )}
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: "count",
              header: t("reports.packages.consumption.count"),
              render: (row) => (
                <span className="tabular-nums">{row.count}</span>
              ),
            },
          ]}
          rows={report.byEmployee}
          getRowKey={(row) => row.employeeId}
        />
      </Section>
    </>
  )
}
