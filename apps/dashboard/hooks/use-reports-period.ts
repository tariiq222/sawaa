"use client"

import { useCallback, useMemo, useState } from "react"
import { riyadhDate, riyadhDayEnd } from "@/lib/audit-date"

export type ReportsPeriodPreset =
  | "today"
  | "last7"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom"

const STORAGE_KEY = "sawa.reports.period"

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}
export function getReportsDefaultRange(period: ReportsPeriodPreset): {
  from: string
  to: string
} {
  const todayStr = riyadhDate(new Date())
  const today = new Date(`${todayStr}T00:00:00Z`)
  const monthStart = todayStr.slice(0, 7) + "-01"
  switch (period) {
    case "today":
      return { from: todayStr, to: todayStr }
    case "last7":
      return {
        from: fmt(new Date(today.getTime() - 6 * 86_400_000)),
        to: todayStr,
      }
    case "lastMonth":
      return {
        from: fmt(
          new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
        ),
        to: fmt(
          new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))
        ),
      }
    case "thisYear":
      return { from: todayStr.slice(0, 4) + "-01-01", to: todayStr }
    default:
      return { from: monthStart, to: todayStr }
  }
}
export function getPreviousRange(
  from: string,
  to: string
): { from: string; to: string } {
  const first = new Date(`${from}T00:00:00Z`).getTime()
  const last = new Date(`${to}T00:00:00Z`).getTime()
  return {
    from: fmt(new Date(first - (last - first + 86_400_000))),
    to: fmt(new Date(first - 86_400_000)),
  }
}

export interface UseReportsPeriodReturn {
  period: ReportsPeriodPreset
  setPeriod: (p: ReportsPeriodPreset) => void
  customFrom: string
  setCustomFrom: (v: string) => void
  customTo: string
  setCustomTo: (v: string) => void
  branchId: string | undefined
  setBranchId: (v: string | undefined) => void
  dateFrom: string
  dateTo: string
  normalizedFrom: string
  normalizedTo: string
  apiDateTo: string
  filenameDateTo: string
  previousRange: { from: string; to: string }
}

function readStoredPeriod(): ReportsPeriodPreset {
  if (typeof window === "undefined") return "thisMonth"
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored && isPreset(stored) ? stored : "thisMonth"
}

export function useReportsPeriod(): UseReportsPeriodReturn {
  const [period, setPeriodState] =
    useState<ReportsPeriodPreset>(readStoredPeriod)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [branchId, setBranchIdState] = useState<string | undefined>(undefined)

  const setPeriod = useCallback((p: ReportsPeriodPreset) => {
    setPeriodState(p)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, p)
    }
  }, [])

  const setBranchId = useCallback((v: string | undefined) => {
    setBranchIdState(v)
  }, [])

  const { dateFrom, dateTo } = useMemo(() => {
    const defaults = getReportsDefaultRange(period)
    return {
      dateFrom:
        period === "custom" ? customFrom || defaults.from : defaults.from,
      dateTo: period === "custom" ? customTo || defaults.to : defaults.to,
    }
  }, [period, customFrom, customTo])

  const normalizedFrom = dateFrom <= dateTo ? dateFrom : dateTo
  const normalizedTo = dateFrom <= dateTo ? dateTo : dateFrom

  const apiDateTo = normalizedTo ? riyadhDayEnd(normalizedTo) : normalizedTo

  const filenameDateTo = normalizedTo ?? ""

  const previousRange = useMemo(
    () => getPreviousRange(normalizedFrom, normalizedTo),
    [normalizedFrom, normalizedTo]
  )

  return {
    period,
    setPeriod,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    branchId,
    setBranchId,
    dateFrom,
    dateTo,
    normalizedFrom,
    normalizedTo,
    apiDateTo,
    filenameDateTo,
    previousRange,
  }
}

function isPreset(s: string): s is ReportsPeriodPreset {
  return [
    "today",
    "last7",
    "thisMonth",
    "lastMonth",
    "thisYear",
    "custom",
  ].includes(s)
}
