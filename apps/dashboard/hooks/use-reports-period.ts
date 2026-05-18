"use client"

import { useState, useMemo } from "react"
import { getReportsDefaultRange, type ReportsPeriodPreset } from "@/components/features/reports/period-filter"

/**
 * Encapsulates reports period state + all derived date values.
 *
 * Date semantics:
 *   - dateFrom / dateTo       — raw display values (yyyy-MM-dd), passed to child components
 *   - normalizedFrom / To     — RTL-safe: ensures from ≤ to
 *   - apiDateTo              — dateTo with T23:59:59.999Z appended so the backend
 *                               lte query covers the full selected day
 *   - filenameDateTo         — clean yyyy-MM-dd for use in export filenames (never ISO)
 */
export function useReportsPeriod() {
  const [period, setPeriod] = useState<ReportsPeriodPreset>("monthly")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const { dateFrom, dateTo } = useMemo(() => {
    const defaults = getReportsDefaultRange(period)
    return {
      dateFrom: period === "custom" ? (customFrom || defaults.from) : defaults.from,
      dateTo: period === "custom" ? (customTo || defaults.to) : defaults.to,
    }
  }, [period, customFrom, customTo])

  // RTL-safe: always use min as from, max as to
  const normalizedFrom = dateFrom <= dateTo ? dateFrom : dateTo
  const normalizedTo = dateFrom <= dateTo ? dateTo : dateFrom

  // API: append end-of-day so lte covers the full selected day
  const apiDateTo = normalizedTo
    ? `${normalizedTo}T23:59:59.999Z`
    : normalizedTo

  // Filename: clean yyyy-MM-dd only — never ISO with T23:59:59.999Z
  const filenameDateTo = normalizedTo ?? ""

  return {
    period,
    setPeriod,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    dateFrom,
    dateTo,
    normalizedFrom,
    normalizedTo,
    apiDateTo,
    filenameDateTo,
  }
}
