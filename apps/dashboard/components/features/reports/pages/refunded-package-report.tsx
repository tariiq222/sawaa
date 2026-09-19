"use client"

import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { KpiCard } from "@/components/features/reports/kpi-card"
import { KpiRow } from "@/components/features/reports/kpi-row"
import { ReportTable } from "@/components/features/reports/report-table"
import { ReportsEmptyState } from "@/components/features/reports/empty-state"
import { Section } from "@/components/features/reports/section"
import type {
  PackageRefundEventSource,
  PackageRefundType,
  RefundedPackageEventRow,
  RefundedPackagesEventsReport,
  RefundedPackagesLegacyReport,
} from "@/lib/types/package-report"

type RefundReportProps = {
  locale: "ar" | "en"
  t: (key: string) => string
}

export function RefundedPackageReport({
  report,
  locale,
  t,
}: RefundReportProps & {
  report: RefundedPackagesEventsReport | RefundedPackagesLegacyReport
}) {
  if (report.historyMode === "LEGACY") {
    return <LegacyRefundedReport report={report} locale={locale} t={t} />
  }
  return <EventRefundedReport report={report} locale={locale} t={t} />
}

function EventRefundedReport({
  report,
  locale,
  t,
}: RefundReportProps & { report: RefundedPackagesEventsReport }) {
  const hasHistory = report.items.length > 0 || report.undatedHistorical.items.length > 0
  if (!hasHistory) return <ReportsEmptyState />

  return (
    <>
      <KpiRow>
        <KpiCard
          label={t("reports.packages.refunded.eventCount")}
          value={<span className="tabular-nums">{report.eventCount}</span>}
        />
        <KpiCard
          label={t("reports.packages.refunded.purchaseCount")}
          value={<span className="tabular-nums">{report.purchaseCount}</span>}
        />
        <KpiCard
          label={t("reports.packages.refunded.totalRefunded")}
          value={<FormattedCurrency amount={report.totalRefunded} locale={locale} />}
        />
      </KpiRow>

      {report.items.length > 0 && (
        <Section title={t("reports.packages.refunded.items")}>
          <RefundEventTable rows={report.items} locale={locale} t={t} />
        </Section>
      )}

      {report.undatedHistorical.items.length > 0 && (
        <Section
          title={t("reports.packages.refunded.undatedItems")}
          subtitle={t("reports.packages.refunded.undatedDescription")}
        >
          <div className="mb-4 flex flex-wrap gap-6 text-xs text-muted-foreground">
            <span>
              {t("reports.packages.refunded.recordCount")}: {" "}
              <strong className="tabular-nums text-foreground">
                {report.undatedHistorical.recordCount}
              </strong>
            </span>
            <span>
              {t("reports.packages.refunded.purchaseCount")}: {" "}
              <strong className="tabular-nums text-foreground">
                {report.undatedHistorical.purchaseCount}
              </strong>
            </span>
            <span>
              {t("reports.packages.refunded.totalRefunded")}: {" "}
              <strong className="text-foreground">
                <FormattedCurrency
                  amount={report.undatedHistorical.totalRefunded}
                  locale={locale}
                />
              </strong>
            </span>
          </div>
          <RefundEventTable rows={report.undatedHistorical.items} locale={locale} t={t} />
        </Section>
      )}
    </>
  )
}

function RefundEventTable({
  rows,
  locale,
  t,
}: RefundReportProps & { rows: RefundedPackageEventRow[] }) {
  return (
    <ReportTable
      columns={[
        {
          key: "date",
          header: t("reports.date"),
          render: (row) => <DateValue value={row.occurredAt} locale={locale} t={t} />,
        },
        {
          key: "source",
          header: t("reports.packages.refunded.source"),
          render: (row) => <span>{sourceLabel(row.source, t)}</span>,
        },
        {
          key: "type",
          header: t("reports.packages.refunded.type"),
          render: (row) => <span>{typeLabel(row.refundType, t)}</span>,
        },
        {
          key: "purchaseId",
          header: t("reports.packages.refunded.purchaseId"),
          render: (row) => <IdValue value={row.purchaseId} t={t} />,
        },
        {
          key: "packageId",
          header: t("reports.packages.refunded.packageId"),
          render: (row) => <IdValue value={row.packageId} t={t} />,
        },
        {
          key: "clientId",
          header: t("reports.packages.refunded.clientId"),
          render: (row) => <IdValue value={row.clientId} t={t} />,
        },
        {
          key: "amountPaid",
          header: t("reports.packages.refunded.amountPaid"),
          render: (row) => <MoneyValue amount={row.amountPaid} locale={locale} t={t} />,
        },
        {
          key: "refundAmount",
          header: t("reports.packages.refunded.refundAmount"),
          render: (row) => (
            <span className="tabular-nums text-error">
              <FormattedCurrency amount={row.refundAmount} locale={locale} />
            </span>
          ),
        },
        {
          key: "notes",
          header: t("reports.packages.refunded.notes"),
          render: (row) => <span className="text-xs text-muted-foreground">{row.notes || t("reports.packages.refunded.notAvailable")}</span>,
        },
      ]}
      rows={rows}
      getRowKey={(row) => row.eventId}
    />
  )
}

function LegacyRefundedReport({
  report,
  locale,
  t,
}: RefundReportProps & { report: RefundedPackagesLegacyReport }) {
  return (
    <>
      <div role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
        {t("reports.packages.refunded.historyIncomplete")}
      </div>
      {report.items.length === 0 ? (
        <ReportsEmptyState />
      ) : (
        <>
          <KpiRow>
            <KpiCard
              label={t("reports.packages.refunded.count")}
              value={<span className="tabular-nums">{report.refundedCount}</span>}
            />
            <KpiCard
              label={t("reports.packages.refunded.totalRefunded")}
              value={<FormattedCurrency amount={report.totalRefunded} locale={locale} />}
            />
          </KpiRow>
          <Section title={t("reports.packages.refunded.items")}>
            <ReportTable
              columns={[
                {
                  key: "date",
                  header: t("reports.date"),
                  render: (row) => <DateValue value={row.refundedAt} locale={locale} t={t} />,
                },
                {
                  key: "purchaseId",
                  header: t("reports.packages.refunded.purchaseId"),
                  render: (row) => <IdValue value={row.purchaseId} t={t} />,
                },
                {
                  key: "amountPaid",
                  header: t("reports.packages.refunded.amountPaid"),
                  render: (row) => <MoneyValue amount={row.amountPaid} locale={locale} t={t} />,
                },
                {
                  key: "refundAmount",
                  header: t("reports.packages.refunded.refundAmount"),
                  render: (row) => (
                    <span className="tabular-nums text-error">
                      <FormattedCurrency amount={row.refundAmount} locale={locale} />
                    </span>
                  ),
                },
                {
                  key: "notes",
                  header: t("reports.packages.refunded.notes"),
                  render: (row) => <span className="text-xs text-muted-foreground">{row.notes || t("reports.packages.refunded.notAvailable")}</span>,
                },
              ]}
              rows={report.items}
              getRowKey={(row) => row.purchaseId}
            />
          </Section>
        </>
      )}
    </>
  )
}

function DateValue({
  value,
  locale,
  t,
}: RefundReportProps & { value: string | null }) {
  return value ? (
    <span className="text-xs text-muted-foreground tabular-nums">
      {new Date(value).toLocaleDateString(locale)}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">{t("reports.packages.refunded.dateUnknown")}</span>
  )
}

function IdValue({ value, t }: Pick<RefundReportProps, "t"> & { value: string | null }) {
  return value ? (
    <span className="font-mono text-xs" dir="ltr">
      {value.slice(0, 8)}
    </span>
  ) : (
    <span className="text-muted-foreground">
      {t("reports.packages.refunded.notAvailable")}
    </span>
  )
}

function MoneyValue({
  amount,
  locale,
  t,
}: RefundReportProps & { amount: number | null }) {
  return amount == null ? (
    <span className="text-muted-foreground">{t("reports.packages.refunded.notAvailable")}</span>
  ) : (
    <FormattedCurrency amount={amount} locale={locale} />
  )
}

function sourceLabel(source: PackageRefundEventSource, t: (key: string) => string) {
  return t(`reports.packages.refunded.source.${source}`)
}

function typeLabel(type: PackageRefundType, t: (key: string) => string) {
  return t(`reports.packages.refunded.type.${type}`)
}
