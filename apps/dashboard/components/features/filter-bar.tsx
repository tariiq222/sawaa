"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { Button } from "@deqah/ui"
import { DatePicker } from "@/components/ui/date-picker"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

/* ─── Types ─── */

export interface FilterTab {
  key: string
  label: string
}

export interface FilterSelect {
  key: string
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onValueChange: (value: string) => void
  width?: string
}

export interface FilterDateRange {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  placeholderFrom?: string
  placeholderTo?: string
}

export interface FilterBarProps {
  /** Optional inline search input */
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  /** Optional result count shown at the end of the filters row */
  resultCount?: React.ReactNode
  /** Optional tab pills (e.g. All, Today, This Week, This Month) */
  tabs?: {
    items: FilterTab[]
    activeKey: string
    onTabChange: (key: string) => void
  }
  /** Select dropdown filters */
  selects?: FilterSelect[]
  /** Date range filter */
  dateRange?: FilterDateRange
  /** Whether any filter is active — controls reset button visibility */
  hasFilters: boolean
  /** Reset all filters */
  onReset: () => void
  /** Optional extra content at the end (e.g. view toggle) */
  trailing?: React.ReactNode
  /** Optional className override */
  className?: string
}

export function FilterBar({
  search,
  tabs,
  selects,
  dateRange,
  hasFilters,
  onReset,
  trailing,
  resultCount,
  className,
}: FilterBarProps) {
  const { t } = useLocale()

  const hasAttributeFilters = !!search || (selects && selects.length > 0) || !!dateRange

  return (
    <div className={cn("glass rounded-xl p-4", className)}>
      {/* Single row: tabs + attribute filters + trailing */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs && (
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-1 me-1">
            {tabs.items.map((tab) => (
              <button
                key={tab.key}
                onClick={() => tabs.onTabChange(tab.key)}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200",
                  tabs.activeKey === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-border/60"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {hasAttributeFilters && (
          <>
            {search && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 min-w-[200px] transition-all duration-200 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50">
                <HugeiconsIcon icon={Search01Icon} size={14} className="shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  placeholder={search.placeholder}
                  aria-label={search.placeholder ?? "Search"}
                  className="border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
              </div>
            )}
            {selects?.map((filter) => (
              <Select
                key={filter.key}
                value={filter.value}
                onValueChange={filter.onValueChange}
              >
                <SelectTrigger
                  size="sm"
                  className={cn("w-auto min-w-[120px]", filter.width)}
                >
                  <SelectValue placeholder={filter.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}

            {dateRange && (
              <>
                {(selects?.length ?? 0) > 0 && (
                  <div className="hidden sm:block mx-1 h-5 w-px bg-border/60" />
                )}
                <DatePicker
                  value={dateRange.dateFrom}
                  onChange={dateRange.onDateFromChange}
                  placeholder={dateRange.placeholderFrom ?? t("common.from")}
                  className="w-auto"
                />
                <span className="text-xs text-muted-foreground px-0.5">—</span>
                <DatePicker
                  value={dateRange.dateTo}
                  onChange={dateRange.onDateToChange}
                  placeholder={dateRange.placeholderTo ?? t("common.to")}
                  className="w-auto"
                />
              </>
            )}

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
                <span>{t("common.reset")}</span>
              </Button>
            )}
            {resultCount !== undefined && (
              <span className="ms-auto text-xs text-muted-foreground tabular-nums">
                {resultCount}
              </span>
            )}
          </>
        )}
        {trailing && <div className="flex items-center ms-auto">{trailing}</div>}
      </div>
    </div>
  )
}
