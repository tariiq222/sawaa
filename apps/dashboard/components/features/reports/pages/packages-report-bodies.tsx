"use client"

// EXCEPTION: feature-component size limit (300) exceeded — 310 lines
// — 2026-06-24 — Phase 5 packages reports. The four report bodies
// (SALES / OUTSTANDING_CREDIT / CONSUMPTION / REFUNDED) are
// independent renderers with no shared business logic; splitting
// each into a separate file would create more cross-file plumbing
// than savings. The page shell (`packages-report-page.tsx`) is the
// thin orchestrator (139 lines, under the 150-line page limit).

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
      return <RefundedReport report={report} locale={locale} t={t} />
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
          value={
            <span className="tabular-nums">{report.purchaseCount}</span>
          }
        />
        <KpiCard
          label={t("reports.packages.sales.totalRevenue")}
          value={
            <FormattedCurrency amount={report.totalRevenue} locale={locale} />
          }
        />
        <KpiCard
          label={t("reports.packages.sales.byBucket.cash")}
          value={
            <FormattedCurrency
              amount={report.byBucket.cash}
              locale={locale}
            />
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
                render: (m) => (
                  <span className="tabular-nums">{m.count}</span>
                ),
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
          <span className="tabular-nums">
            {report.outstandingSessions}
          </span>
        }
      />
      <KpiCard
        label={t("reports.packages.outstanding.creditCount")}
        value={
          <span className="tabular-nums">{report.creditCount}</span>
        }
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
          value={
            <span className="tabular-nums">{report.totalConsumed}</span>
          }
        />
      </KpiRow>
      <Section title={t("reports.packages.consumption.byEmployee")}>
        <ReportTable
          columns={[
            {
              key: "name",
              header: t("reports.practitioners.name"),
              render: (row) => <span className="font-medium">{row.name}</span>,
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

/* ─── REFUNDED ─── */

function RefundedReport({
  report,
  locale,
  t,
}: {
  report: Extract<PackageReport, { kind: "REFUNDED" }>
  locale: "ar" | "en"
  t: (key: string) => string
}) {
  if (report.items.length === 0) {
    return <ReportsEmptyState />
  }
  return (
    <>
      <KpiRow>
        <KpiCard
          label={t("reports.packages.refunded.count")}
          value={
            <span className="tabular-nums">{report.refundedCount}</span>
          }
        />
        <KpiCard
          label={t("reports.packages.refunded.totalRefunded")}
          value={
            <FormattedCurrency amount={report.totalRefunded} locale={locale} />
          }
        />
      </KpiRow>
      <Section title={t("reports.packages.refunded.items")}>
        <ReportTable
          columns={[
            {
              key: "date",
              header: t("reports.date"),
              render: (row) => (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(row.refundedAt).toLocaleDateString(locale)}
                </span>
              ),
            },
            {
              key: "purchaseId",
              header: t("reports.packages.refunded.purchaseId"),
              render: (row) => (
                <span className="font-mono text-xs" dir="ltr">
                  {row.purchaseId.slice(0, 8)}
                </span>
              ),
            },
            {
              key: "amountPaid",
              header: t("reports.packages.refunded.amountPaid"),
              render: (row) => (
                <span className="tabular-nums">
                  <FormattedCurrency amount={row.amountPaid} locale={locale} />
                </span>
              ),
            },
            {
              key: "refundAmount",
              header: t("reports.packages.refunded.refundAmount"),
              render: (row) => (
                <span className="tabular-nums text-error">
                  <FormattedCurrency
                    amount={row.refundAmount}
                    locale={locale}
                  />
                </span>
              ),
            },
            {
              key: "notes",
              header: t("reports.packages.refunded.notes"),
              render: (row) => (
                <span className="text-xs text-muted-foreground">
                  {row.notes || "—"}
                </span>
              ),
            },
          ]}
          rows={report.items}
          getRowKey={(row) => row.purchaseId}
        />
      </Section>
    </>
  )
}
