"use client"

import { useCallback, useMemo, useState } from "react"
import {
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  endOfMonth,
  subDays,
  subMonths,
} from "date-fns"

export type ReportsPeriodPreset =
  | "today"
  | "last7"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom"

const STORAGE_KEY = "sawa.reports.period"
const STORAGE_BRANCH = "sawa.reports.branch"

function fmt(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

export function getReportsDefaultRange(
  period: ReportsPeriodPreset,
): { from: string; to: string } {
  const today = new Date()
  const todayStr = fmt(today)
  switch (period) {
    case "today":
      return { from: todayStr, to: todayStr }
    case "last7":
      return { from: fmt(subDays(today, 6)), to: todayStr }
    case "thisMonth":
      return { from: fmt(startOfMonth(today)), to: todayStr }
    case "lastMonth": {
      const lm = subMonths(today, 1)
      return { from: fmt(startOfMonth(lm)), to: fmt(endOfMonth(lm)) }
    }
    case "thisYear":
      return { from: fmt(startOfYear(today)), to: todayStr }
    case "custom":
    default:
      return { from: fmt(startOfMonth(today)), to: todayStr }
  }
}

/**
 * Returns the immediately-previous range of the same length.
 * E.g. for [Jan 10–Jan 20] returns [Dec 31–Jan 9].
 */
export function getPreviousRange(
  from: string,
  to: string,
): { from: string; to: string } {
  const fromD = startOfDay(new Date(from))
  const toD = startOfDay(new Date(to))
  const lengthMs = toD.getTime() - fromD.getTime() + 24 * 60 * 60 * 1000
  const prevTo = new Date(fromD.getTime() - 24 * 60 * 60 * 1000)
  const prevFrom = new Date(prevTo.getTime() - lengthMs + 24 * 60 * 60 * 1000)
  return { from: fmt(prevFrom), to: fmt(prevTo) }
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

function readStoredBranch(): string | undefined {
  if (typeof window === "undefined") return undefined
  return window.localStorage.getItem(STORAGE_BRANCH) ?? undefined
}

export function useReportsPeriod(): UseReportsPeriodReturn {
  const [period, setPeriodState] = useState<ReportsPeriodPreset>(readStoredPeriod)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [branchId, setBranchIdState] = useState<string | undefined>(readStoredBranch)

  const setPeriod = useCallback((p: ReportsPeriodPreset) => {
    setPeriodState(p)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, p)
    }
  }, [])

  const setBranchId = useCallback((v: string | undefined) => {
    setBranchIdState(v)
    if (typeof window !== "undefined") {
      if (v) window.localStorage.setItem(STORAGE_BRANCH, v)
      else window.localStorage.removeItem(STORAGE_BRANCH)
    }
  }, [])

  const { dateFrom, dateTo } = useMemo(() => {
    const defaults = getReportsDefaultRange(period)
    return {
      dateFrom: period === "custom" ? customFrom || defaults.from : defaults.from,
      dateTo: period === "custom" ? customTo || defaults.to : defaults.to,
    }
  }, [period, customFrom, customTo])

  const normalizedFrom = dateFrom <= dateTo ? dateFrom : dateTo
  const normalizedTo = dateFrom <= dateTo ? dateTo : dateFrom

  const apiDateTo = normalizedTo
    ? `${normalizedTo}T23:59:59.999Z`
    : normalizedTo

  const filenameDateTo = normalizedTo ?? ""

  const previousRange = useMemo(
    () => getPreviousRange(normalizedFrom, normalizedTo),
    [normalizedFrom, normalizedTo],
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
