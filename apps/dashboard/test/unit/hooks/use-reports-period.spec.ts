import { describe, expect, it } from "vitest"
import {
  getReportsDefaultRange,
  getPreviousRange,
} from "@/hooks/use-reports-period"

describe("useReportsPeriod helpers", () => {
  it("returns today preset as single day", () => {
    const r = getReportsDefaultRange("today")
    expect(r.from).toBe(r.to)
  })

  it("returns last7 as a 7-day span", () => {
    const r = getReportsDefaultRange("last7")
    const fromDate = new Date(r.from)
    const toDate = new Date(r.to)
    const days = Math.round(
      (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000),
    )
    expect(days).toBe(6)
  })

  it("returns thisMonth covering current month start to today", () => {
    const r = getReportsDefaultRange("thisMonth")
    expect(r.from.endsWith("-01")).toBe(true)
  })

  it("returns lastMonth as full previous month", () => {
    const r = getReportsDefaultRange("lastMonth")
    expect(r.from.endsWith("-01")).toBe(true)
  })

  it("getPreviousRange returns symmetric range", () => {
    const prev = getPreviousRange("2026-01-10", "2026-01-20")
    expect(prev.to).toBe("2026-01-09")
    expect(prev.from).toBe("2025-12-30")
  })

  it("getPreviousRange handles single-day range", () => {
    const prev = getPreviousRange("2026-01-10", "2026-01-10")
    expect(prev.from).toBe("2026-01-09")
    expect(prev.to).toBe("2026-01-09")
  })
})
