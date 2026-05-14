import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchBranding,
  updateBranding,
} = vi.hoisted(() => ({
  fetchBranding: vi.fn(),
  updateBranding: vi.fn(),
}))

vi.mock("@/lib/api/branding", () => ({
  fetchBranding,
  updateBranding,
}))

import { useBranding, useUpdateBranding } from "@/hooks/use-branding"

describe("useBranding", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches branding config", async () => {
    const config = { colorPrimary: "#354FD8", logoUrl: "https://example.com/logo.png" }
    fetchBranding.mockResolvedValueOnce(config)

    const { result } = renderHook(() => useBranding(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchBranding).toHaveBeenCalled()
    expect(result.current.data).toEqual(config)
  })
})

describe("useUpdateBranding", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls updateBranding with payload", async () => {
    updateBranding.mockResolvedValueOnce({ colorPrimary: "#000000" })

    const { result } = renderHook(() => useUpdateBranding(), { wrapper: createWrapper() })

    result.current.mutate({ colorPrimary: "#000000" } as Parameters<typeof updateBranding>[0])

    await waitFor(() => expect(updateBranding).toHaveBeenCalled())
  })
})
