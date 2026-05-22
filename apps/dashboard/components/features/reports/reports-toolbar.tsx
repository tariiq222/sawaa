"use client"

import { useState } from "react"
import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useBranches } from "@/hooks/use-branches"
import { cn } from "@/lib/utils"
import type { ReportsPeriodPreset } from "@/hooks/use-reports-period"
import { DatePicker } from "@/components/ui/date-picker"
import { toast } from "sonner"
import {
  exportReportExcel,
  type ExportableReportType,
} from "@/lib/api/reports"

interface ReportsToolbarProps {
  period: ReportsPeriodPreset
  onPeriodChange: (p: ReportsPeriodPreset) => void
  dateFrom: string
  dateTo: string
  customFrom: string
  customTo: string
  onCustomFromChange: (v: string) => void
  onCustomToChange: (v: string) => void
  branchId: string | undefined
  onBranchIdChange: (v: string | undefined) => void
  /** Active report type — used for the export button */
  exportType: ExportableReportType
  filenameDateTo: string
}

const PRESETS: { key: ReportsPeriodPreset; labelKey: string }[] = [
  { key: "today", labelKey: "reports.period.today" },
  { key: "last7", labelKey: "reports.period.last7" },
  { key: "thisMonth", labelKey: "reports.period.thisMonth" },
  { key: "lastMonth", labelKey: "reports.period.lastMonth" },
  { key: "thisYear", labelKey: "reports.period.thisYear" },
  { key: "custom", labelKey: "reports.period.custom" },
]

export function ReportsToolbar({
  period,
  onPeriodChange,
  dateFrom,
  dateTo,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  branchId,
  onBranchIdChange,
  exportType,
  filenameDateTo,
}: ReportsToolbarProps) {
  const { t } = useLocale()
  const { branches } = useBranches()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportReportExcel({
        type: exportType,
        dateFrom,
        dateTo: filenameDateTo || dateTo,
        branchId,
      })
    } catch {
      toast.error(t("reports.exportError"))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onPeriodChange(p.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                period === p.key
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`reports-period-${p.key}`}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <DatePicker
              value={customFrom}
              onChange={onCustomFromChange}
              placeholder={t("reports.dateFrom")}
            />
            <span className="text-muted-foreground text-sm">—</span>
            <DatePicker
              value={customTo}
              onChange={onCustomToChange}
              placeholder={t("reports.dateTo")}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {branches && branches.length > 0 && (
          <select
            value={branchId ?? ""}
            onChange={(e) => onBranchIdChange(e.target.value || undefined)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            data-testid="reports-branch-select"
          >
            <option value="">{t("reports.allBranches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nameAr ?? b.nameEn ?? ""}
              </option>
            ))}
          </select>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          data-testid="reports-export-btn"
        >
          {exporting ? t("reports.exporting") : t("reports.exportCsv")}
        </Button>
      </div>
    </div>
  )
}
