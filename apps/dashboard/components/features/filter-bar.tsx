"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { Button } from "@sawaa/ui"
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

  return (
    <div className={cn("rounded-2xl border border-border bg-card/60 p-3 ring-1 ring-primary/[0.04]", className)}>
      {/* Row 1: tabs + search + trailing | Row 2: attribute filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
        {tabs && (
          <div
            role="tablist"
            aria-label={t("common.filters")}
            className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-background p-1 me-1"
          >
            {tabs.items.map((tab) => {
              const isActive = tabs.activeKey === tab.key
              return (
                <button
                  key={tab.key}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => tabs.onTabChange(tab.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-primary/[0.06]"
                  )}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {search && (
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 min-w-[200px] transition-all duration-200 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50">
            <span className="sr-only">{search.placeholder ?? t("common.search")}</span>
            <HugeiconsIcon icon={Search01Icon} size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder}
              className="border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </label>
        )}
        {trailing && <div className="flex items-center ms-auto">{trailing}</div>}
        </div>

        {((selects?.length ?? 0) > 0 || dateRange) && (
          <div className="flex flex-wrap items-center gap-2">
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
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{dateRange.placeholderFrom ?? t("common.from")}</span>
                  <DatePicker
                    value={dateRange.dateFrom}
                    onChange={dateRange.onDateFromChange}
                    placeholder={dateRange.placeholderFrom ?? t("common.from")}
                    className="w-auto"
                  />
                </div>
                <span className="text-xs text-muted-foreground px-0.5">—</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{dateRange.placeholderTo ?? t("common.to")}</span>
                  <DatePicker
                    value={dateRange.dateTo}
                    onChange={dateRange.onDateToChange}
                    placeholder={dateRange.placeholderTo ?? t("common.to")}
                    className="w-auto"
                  />
                </div>
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
          </div>
        )}
      </div>
    </div>
  )
}
