import type { PackageReport } from "@/lib/types/package-report"

type T = (key: string) => string
const sar = (value: number) => (value / 100).toFixed(2)
/** CSV text fields are quoted and never evaluated as spreadsheet formulas. */
function cell(value: unknown): string {
  const text = String(value ?? "")
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
export function packageReportCsv(report: PackageReport, t: T): string {
  const rows: unknown[][] = []
  const metric = (key: string, value: unknown) => rows.push([t(key), value])
  if (report.kind === "SALES") {
    rows.push([t("reports.export.metric"), t("reports.export.value")])
    metric("reports.packages.sales.purchaseCount", report.purchaseCount)
    metric("reports.packages.sales.grossRevenue", sar(report.grossRevenue))
    metric("reports.packages.sales.refundedAmount", sar(report.refundedAmount))
    metric("reports.packages.sales.netRevenue", sar(report.netRevenue))
    for (const bucket of ["cash", "network", "electronic"] as const)
      metric(
        `reports.packages.sales.byBucket.${bucket}`,
        sar(report.byBucket[bucket])
      )
    rows.push(
      [],
      [
        t("reports.export.method"),
        t("reports.export.amountSar"),
        t("reports.export.count"),
      ]
    )
    for (const row of report.byMethod)
      rows.push([
        t(`reports.paymentMethod.${row.method}`),
        sar(row.amount),
        row.count,
      ])
  } else if (report.kind === "OUTSTANDING_CREDIT") {
    rows.push([t("reports.export.metric"), t("reports.export.value")])
    metric(
      "reports.packages.outstanding.liability",
      sar(report.outstandingLiability)
    )
    metric("reports.packages.outstanding.sessions", report.outstandingSessions)
    metric("reports.packages.outstanding.creditCount", report.creditCount)
    metric(
      "reports.packages.outstanding.reservedSessions",
      report.reservedSessions
    )
  } else if (report.kind === "CONSUMPTION") {
    rows.push([t("reports.practitioners.name"), t("reports.export.count")])
    for (const row of report.byEmployee)
      rows.push([row.name || row.employeeId, row.count])
    metric("reports.packages.consumption.totalConsumed", report.totalConsumed)
  } else {
    rows.push([t("reports.export.metric"), t("reports.export.value")])
    metric("reports.packages.refunded.totalRefunded", sar(report.totalRefunded))
    rows.push(
      [],
      [
        t("reports.export.reference"),
        t("reports.export.date"),
        t("reports.export.amountSar"),
      ]
    )
    for (const row of report.items)
      rows.push([
        row.purchaseId,
        "occurredAt" in row ? row.occurredAt : row.refundedAt,
        sar(row.refundAmount),
      ])
    if (report.historyMode === "EVENTS") {
      rows.push(
        [],
        [
          t("reports.packages.refunded.undatedItems"),
          sar(report.undatedHistorical.totalRefunded),
        ]
      )
      for (const row of report.undatedHistorical.items)
        rows.push([row.purchaseId, row.occurredAt, sar(row.refundAmount)])
    }
  }
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")
}
export function downloadPackageReport(
  report: PackageReport,
  from: string,
  to: string,
  t: T
): void {
  const url = URL.createObjectURL(
    new Blob([packageReportCsv(report, t)], { type: "text/csv;charset=utf-8" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = `packages-${report.kind.toLowerCase()}-${from}-${to}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
