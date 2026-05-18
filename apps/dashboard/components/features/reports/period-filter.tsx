"use client"

import { format, startOfMonth, startOfYear } from "date-fns"
import { FilterBar } from "@/components/features/filter-bar"
import { useLocale } from "@/components/locale-provider"

export type ReportsPeriodPreset = "monthly" | "yearly" | "custom"

interface ReportsPeriodFilterProps {
  period: ReportsPeriodPreset
  dateFrom: string
  dateTo: string
  onPeriodChange: (period: ReportsPeriodPreset) => void
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onReset: () => void
}

export function ReportsPeriodFilter({
  period,
  dateFrom,
  dateTo,
  onPeriodChange,
  onDateFromChange,
  onDateToChange,
  onReset,
}: ReportsPeriodFilterProps) {
  const { t } = useLocale()

  const showDatePickers = period === "custom"

  return (
    <FilterBar
      tabs={{
        items: [
          { key: "monthly", label: t("reports.period.monthly") },
          { key: "yearly", label: t("reports.period.yearly") },
          { key: "custom", label: t("reports.period.custom") },
        ],
        activeKey: period,
        onTabChange: (key) => onPeriodChange(key as ReportsPeriodPreset),
      }}
      dateRange={
        showDatePickers
          ? {
              dateFrom,
              dateTo,
              onDateFromChange,
              onDateToChange,
              placeholderFrom: t("reports.dateFrom"),
              placeholderTo: t("reports.dateTo"),
            }
          : undefined
      }
      hasFilters={period !== "monthly"}
      onReset={onReset}
    />
  )
}

/**
 * Computes the default date range for a given period preset.
 * Returns { from, to } strings in yyyy-MM-dd format.
 */
export function getReportsDefaultRange(
  period: ReportsPeriodPreset,
): { from: string; to: string } {
  const today = format(new Date(), "yyyy-MM-dd")

  if (period === "monthly") {
    return {
      from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      to: today,
    }
  }
  if (period === "yearly") {
    return {
      from: format(startOfYear(new Date()), "yyyy-MM-dd"),
      to: today,
    }
  }
  // custom — caller decides, default to current month
  return {
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: today,
  }
}