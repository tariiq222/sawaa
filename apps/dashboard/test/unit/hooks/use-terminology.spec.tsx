/**
 * useTerminology — unit tests
 *
 * Covers:
 *  1. Returns key as fallback when token is missing from pack
 *  2. Returns Arabic value when locale is 'ar' and token exists
 *  3. Returns English value when locale is 'en' and token exists
 *  4. Query is disabled when verticalSlug is undefined
 *  5. t() works before pack loads — returns key as fallback
 */

import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"
import React from "react"

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
import type { TerminologyPack } from "@/hooks/use-terminology"

/* ─── Helpers ─── */

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

const samplePack: TerminologyPack = {
  client: { ar: "مريض", en: "Patient" },
  employee: { ar: "معالج", en: "Therapist" },
}

/* ─── Tests ─── */

describe("useTerminology", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default locale = ar
    mockUseLocale.mockReturnValue({ locale: "ar" })
  })

  // 1. Returns key as fallback when token is missing from pack
  it("returns the key when token is absent from pack", async () => {
    mockApiGet.mockResolvedValueOnce(samplePack)

    const { result } = renderHook(
      () => useTerminology("clinic"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.t("unknown_token")).toBe("unknown_token")
  })

  // 2. Returns Arabic value when locale is 'ar' and override exists
  it("returns Arabic value when locale is ar", async () => {
    mockUseLocale.mockReturnValue({ locale: "ar" })
    mockApiGet.mockResolvedValueOnce(samplePack)

    const { result } = renderHook(
      () => useTerminology("clinic"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.t("client")).toBe("مريض")
  })

  // 3. Returns English value when locale is 'en' and override exists
  it("returns English value when locale is en", async () => {
    mockUseLocale.mockReturnValue({ locale: "en" })
    mockApiGet.mockResolvedValueOnce(samplePack)

    const { result } = renderHook(
      () => useTerminology("clinic"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.t("employee")).toBe("Therapist")
  })

  // 4. Query is disabled when verticalSlug is undefined
  it("does not fire a query when verticalSlug is undefined", () => {
    const { result } = renderHook(
      () => useTerminology(undefined),
      { wrapper: makeWrapper() },
    )

    // With enabled:false the query never starts → isLoading stays false, pack stays undefined
    expect(result.current.isLoading).toBe(false)
    expect(result.current.pack).toBeUndefined()
    expect(mockApiGet).not.toHaveBeenCalled()
  })

  // 5. t() returns key before pack loads
  it("returns the key as fallback before pack is available", () => {
    // Never resolve so we stay in loading state
    mockApiGet.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(
      () => useTerminology("clinic"),
      { wrapper: makeWrapper() },
    )

    // Pack is still undefined while loading
    expect(result.current.pack).toBeUndefined()
    expect(result.current.t("client")).toBe("client")
  })
})
