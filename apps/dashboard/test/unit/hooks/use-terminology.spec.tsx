/**
 * useTerminology — unit tests
 *
 * Covers:
 *  1. Returns key as fallback when token is missing
 *  2. Returns Arabic value when locale is 'ar' and token exists
 *  3. Returns English value when locale is 'en' and token exists
 *  4. Does not call the old dynamic terminology endpoint
 */

import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

/* ─── Mock api ─── */

const mockApiGet = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", () => ({
  api: { get: mockApiGet },
}))

/* ─── Mock useLocale ─── */

const mockUseLocale = vi.hoisted(() => vi.fn())

vi.mock("@/components/locale-provider", () => ({
  useLocale: mockUseLocale,
}))

/* ─── Import after mocks ─── */

import { useTerminology } from "@/hooks/use-terminology"

/* ─── Tests ─── */

describe("useTerminology", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLocale.mockReturnValue({ locale: "ar" })
  })

  // 1. Returns key as fallback when token is missing
  it("returns the key when token is absent", () => {
    const { result } = renderHook(() => useTerminology("clinic"))

    expect(result.current.t("unknown_token")).toBe("unknown_token")
  })

  // 2. Returns Arabic value when locale is 'ar' and token exists
  it("returns Arabic value when locale is ar", () => {
    mockUseLocale.mockReturnValue({ locale: "ar" })

    const { result } = renderHook(() => useTerminology("clinic"))

    expect(result.current.t("client.plural")).toBe("المستفيدين")
  })

  // 3. Returns English value when locale is 'en' and token exists
  it("returns English value when locale is en", () => {
    mockUseLocale.mockReturnValue({ locale: "en" })

    const { result } = renderHook(() => useTerminology("clinic"))

    expect(result.current.t("employee.plural")).toBe("Employees")
  })

  // 4. Does not call the old dynamic terminology endpoint
  it("does not fire a query for any verticalSlug", () => {
    const { result } = renderHook(() => useTerminology("clinic"))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.pack).toBeDefined()
    expect(mockApiGet).not.toHaveBeenCalled()
  })
})
