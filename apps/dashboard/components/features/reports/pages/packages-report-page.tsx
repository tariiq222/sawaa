"use client"

/**
 * Package Reports Page — Sawaa Dashboard
 *
 * Phase 5 — the four session-package operational reports, rendered
 * side-by-side behind a single type selector + date-range toolbar
 * (the existing `ReportPageShell` + `useReportsPeriodCtx` plumbing).
 *
 *   SALES              — count + revenue + by-method breakdown
 *   OUTSTANDING_CREDIT — total liability halalas + remaining sessions
 *                         (point-in-time; date range ignored server-side)
 *   CONSUMPTION        — per-employee counts of CONSUMED credits
 *   REFUNDED           — list of REFUNDED purchases + total refunded
 *
 * The page is a thin orchestrator; the four per-report body
 * renderers live in `packages-report-bodies.tsx` (a sibling) so this
 * file stays under the 300-line feature-component rule.
 */

import { useState } from "react"

import { useLocale } from "@/components/locale-provider"
import { Skeleton } from "@sawaa/ui"
import { usePackageReport } from "@/hooks/use-package-reports"
import { useReportsPeriodCtx } from "@/components/features/reports/reports-period-context"
import { ReportPageShell } from "@/components/features/reports/report-page-shell"
import { KpiRow } from "@/components/features/reports/kpi-row"
import { ErrorBanner } from "@/components/features/error-banner"
import { ReportsEmptyState } from "@/components/features/reports/empty-state"
import { PackageReportBody } from "./packages-report-bodies"
import type { PackageReportType } from "@/lib/types/package-report"
import type { ExportableReportType } from "@/lib/api/reports"
import { cn } from "@/lib/utils"

/* ─── Type selector ─── */

const REPORT_TYPES: { value: PackageReportType; labelKey: string }[] = [
  { value: "SALES", labelKey: "reports.packages.type.sales" },
  { value: "OUTSTANDING_CREDIT", labelKey: "reports.packages.type.outstanding" },
  { value: "CONSUMPTION", labelKey: "reports.packages.type.consumption" },
  { value: "REFUNDED", labelKey: "reports.packages.type.refunded" },
]

/* ─── Page ─── */

export function PackagesReportPage() {
  const { t } = useLocale()
  const period = useReportsPeriodCtx()
  const [type, setType] = useState<PackageReportType>("SALES")

  // Package reports are JSON-only — `ExportableReportType` does not
  // include them, so we pass OVERVIEW as a benign placeholder that
  // the Excel exporter ignores (the toolbar's export button is not
  // wired for this page — see ReportPageShell's exportType prop).
  const exportType: ExportableReportType = "OVERVIEW"

  const params = {
    report: type,
    from: period.normalizedFrom,
    to: period.apiDateTo,
  }

  const { data, isLoading, error, refetch } = usePackageReport(
    params.report,
    params.from,
    params.to,
  )
  const errMsg =
    error instanceof Error ? t("error.server") : t("error.unexpected")

  return (
    <ReportPageShell
      title={t("reports.packages.title")}
      description={t("reports.packages.description")}
      exportType={exportType}
    >
      <div className="flex flex-col gap-5">
        <PackageTypeSelector value={type} onChange={setType} t={t} />

        {isLoading ? (
          <KpiRow>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </KpiRow>
        ) : error ? (
          <ErrorBanner message={errMsg} onRetry={() => refetch()} />
        ) : !data ? (
          <ReportsEmptyState />
        ) : (
          <PackageReportBody report={data} />
        )}
      </div>
    </ReportPageShell>
  )
}

/* ─── Type selector ─── */

function PackageTypeSelector({
  value,
  onChange,
  t,
}: {
  value: PackageReportType
  onChange: (next: PackageReportType) => void
  t: (key: string) => string
}) {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
      role="tablist"
      aria-label={t("reports.packages.type.label")}
    >
      {REPORT_TYPES.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            data-testid={`package-report-type-${opt.value}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(opt.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
