import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { useReportsPeriod } from "@/hooks/use-reports-period"
describe("Riyadh report query boundaries", () => {
  it("includes the entire current Riyadh day and ignores hidden stored branches", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-10T14:00:00Z"))
    window.localStorage.setItem("sawa.reports.branch", "hidden-branch")
    const { result } = renderHook(() => useReportsPeriod())
    expect(result.current.apiDateTo).toBe("2026-10-10T20:59:59.999Z")
    expect(result.current.branchId).toBeUndefined()
    vi.useRealTimers()
  })
})
