"use client"

import { FilterBar } from "@/components/features/filter-bar"
import { useLocale } from "@/components/locale-provider"

export type StatsRangePreset = "today" | "week" | "month" | "custom"

interface StatsRangeFilterProps {
  preset: StatsRangePreset
  from: string
  to: string
  onPresetChange: (preset: StatsRangePreset) => void
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onReset: () => void
}

export function StatsRangeFilter({
  preset,
  from,
  to,
  onPresetChange,
  onFromChange,
  onToChange,
  onReset,
}: StatsRangeFilterProps) {
  const { t } = useLocale()

  return (
    <FilterBar
      tabs={{
        items: [
          { key: "today", label: t("dashboard.range.today") },
          { key: "week", label: t("dashboard.range.week") },
          { key: "month", label: t("dashboard.range.month") },
        ],
        activeKey: preset,
        onTabChange: (key) => onPresetChange(key as StatsRangePreset),
      }}
      dateRange={{
        dateFrom: from,
        dateTo: to,
        onDateFromChange: onFromChange,
        onDateToChange: onToChange,
      }}
      hasFilters={preset !== "today"}
      onReset={onReset}
    />
  )
}
