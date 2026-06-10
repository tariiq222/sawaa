import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchSiteSettings, bulkUpsertSiteSettings, toastError, toastSuccess } = vi.hoisted(() => ({
  fetchSiteSettings: vi.fn(),
  bulkUpsertSiteSettings: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/lib/api/site-settings", () => ({
  fetchSiteSettings,
  bulkUpsertSiteSettings,
}))

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))

import { useSiteSettings, useUpsertSiteSettings } from "@/hooks/use-site-settings"
import { ApiError } from "@/lib/api"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useSiteSettings", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches all settings when no prefix is given", async () => {
    const rows = [{ key: "hero.title", value: "سواء" }]
    fetchSiteSettings.mockResolvedValue(rows)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useSiteSettings(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual(rows))
    expect(fetchSiteSettings).toHaveBeenCalledWith(undefined)
  })

  it("passes the prefix through to the api", async () => {
    fetchSiteSettings.mockResolvedValue([])
    const { Wrapper } = makeWrapper()
    renderHook(() => useSiteSettings("hero"), { wrapper: Wrapper })

    await waitFor(() => expect(fetchSiteSettings).toHaveBeenCalledWith("hero"))
  })
})

describe("useUpsertSiteSettings", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("invalidates site settings and toasts success on save", async () => {
    bulkUpsertSiteSettings.mockResolvedValue({ updated: 1 })
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useUpsertSiteSettings(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync({ entries: [{ key: "home.hero.titleHighlight.ar", valueAr: "السواء" }] })
    })

    expect(bulkUpsertSiteSettings).toHaveBeenCalledWith({
      entries: [{ key: "home.hero.titleHighlight.ar", valueAr: "السواء" }],
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["site-settings"] })
    expect(toastSuccess).toHaveBeenCalledWith("تم حفظ المحتوى")
  })

  it("toasts the ApiError message when the backend rejects", async () => {
    bulkUpsertSiteSettings.mockRejectedValue(
      new ApiError(422, "قيمة غير صالحة للمفتاح hero.title", null),
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpsertSiteSettings(), { wrapper: Wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ entries: [] }),
      ).rejects.toBeInstanceOf(ApiError)
    })

    expect(toastError).toHaveBeenCalledWith("قيمة غير صالحة للمفتاح hero.title")
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("falls back to the generic Arabic message for non-Api errors", async () => {
    bulkUpsertSiteSettings.mockRejectedValue(new Error("fetch failed"))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpsertSiteSettings(), { wrapper: Wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ entries: [] })).rejects.toBeTruthy()
    })

    expect(toastError).toHaveBeenCalledWith("فشل حفظ المحتوى")
  })
})
