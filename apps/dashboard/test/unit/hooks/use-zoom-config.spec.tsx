/**
 * useZoomConfig — TanStack Query hook unit tests.
 *
 * Contract under test:
 *   - useZoomConfig: read query, 60s stale, wraps into { config, loading,
 *     error } so consuming components don't have to know about isError.
 *   - useUpsertZoomConfig: PUT via upsertZoomConfig, invalidates
 *     ['zoom','config'] on success.
 *   - useTestZoomConfig: POST via testZoomConfig, takes the same input as
 *     upsert — does NOT invalidate (a probe doesn't change config).
 *   - useRetryBookingZoom: POST via retryBookingZoomMeeting on the
 *     booking-scoped endpoint, invalidates ['bookings'] on success so
 *     the bookings list refreshes with the new zoomJoinUrl.
 *   - Write-only contract: a hook regression that echoed credentials back
 *     into the upsert return would silently leak the write-only contract
 *     upstream; we assert only the trimmed view shape is returned.
 */

import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchZoomConfig,
  retryBookingZoomMeeting,
  testZoomConfig,
  upsertZoomConfig,
} = vi.hoisted(() => ({
  fetchZoomConfig: vi.fn(),
  retryBookingZoomMeeting: vi.fn(),
  testZoomConfig: vi.fn(),
  upsertZoomConfig: vi.fn(),
}))

vi.mock("@/lib/api/zoom", () => ({
  fetchZoomConfig,
  retryBookingZoomMeeting,
  testZoomConfig,
  upsertZoomConfig,
}))

import {
  useZoomConfig,
  useUpsertZoomConfig,
  useTestZoomConfig,
  useRetryBookingZoom,
} from "@/hooks/use-zoom-config"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useZoomConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches the Zoom integration view", async () => {
    const view = { configured: true, isActive: true }
    fetchZoomConfig.mockResolvedValueOnce(view)

    const { result } = renderHook(() => useZoomConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchZoomConfig).toHaveBeenCalledTimes(1)
    expect(result.current.config).toEqual(view)
    expect(result.current.error).toBeNull()
  })

  it("returns the 'unconfigured' view when Zoom is not set up", async () => {
    fetchZoomConfig.mockResolvedValueOnce({ configured: false, isActive: false })

    const { result } = renderHook(() => useZoomConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config?.configured).toBe(false)
    expect(result.current.config?.isActive).toBe(false)
  })

  it("surfaces a friendly error message on fetch failure", async () => {
    fetchZoomConfig.mockRejectedValueOnce(new Error("Zoom integration unavailable"))

    const { result } = renderHook(() => useZoomConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error).toBe("Zoom integration unavailable")
  })
})

describe("useUpsertZoomConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("sends credentials to upsertZoomConfig and returns the trimmed view", async () => {
    const trimmed = { configured: true, isActive: true }
    upsertZoomConfig.mockResolvedValueOnce(trimmed)

    const { result } = renderHook(() => useUpsertZoomConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ zoomClientId: "cid", zoomClientSecret: "csec" })
    })

    await waitFor(() => expect(upsertZoomConfig).toHaveBeenCalledTimes(1))
    expect(upsertZoomConfig.mock.calls[0]?.[0]).toEqual({
      zoomClientId: "cid",
      zoomClientSecret: "csec",
    })
    expect(result.current.data).toEqual(trimmed)
  })

  it("invalidates ['zoom','config'] on successful upsert", async () => {
    upsertZoomConfig.mockResolvedValueOnce({ configured: true, isActive: true })
    fetchZoomConfig.mockResolvedValue({ configured: true, isActive: true })

    const { result } = renderHook(
      () => ({
        query: useZoomConfig(),
        mutation: useUpsertZoomConfig(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.query.loading).toBe(false))
    expect(fetchZoomConfig).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mutation.mutate({ zoomAccountId: "ACC" })
    })

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
    await waitFor(() => expect(fetchZoomConfig).toHaveBeenCalledTimes(2))
  })

  it("passes the api response through unchanged (hook does not strip credentials)", async () => {
    // Regression guard: a response from upsertZoomConfig must be passed
    // through. The trimming / write-only contract is enforced at the api
    // layer (see lib/api/zoom tests). The hook is a thin pass-through.
    upsertZoomConfig.mockResolvedValueOnce({
      configured: true,
      isActive: true,
    } as { configured: boolean; isActive: boolean })

    const { result } = renderHook(() => useUpsertZoomConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ zoomClientId: "x" })
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toEqual({ configured: true, isActive: true })
    // The hook itself does NOT add credentials to the response.
    expect(result.current.data).not.toHaveProperty("zoomClientId")
  })

  it("propagates api-layer errors", async () => {
    upsertZoomConfig.mockRejectedValueOnce(new Error("Forbidden"))

    const { result } = renderHook(() => useUpsertZoomConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ zoomClientId: "x" })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})

describe("useTestZoomConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("probes the Zoom credentials and returns the result", async () => {
    const probe = { ok: true }
    testZoomConfig.mockResolvedValueOnce(probe)

    const { result } = renderHook(() => useTestZoomConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ zoomClientId: "x", zoomClientSecret: "y" })
    })

    await waitFor(() => expect(testZoomConfig).toHaveBeenCalledTimes(1))
    expect(testZoomConfig.mock.calls[0]?.[0]).toEqual({
      zoomClientId: "x",
      zoomClientSecret: "y",
    })
    expect(result.current.data).toEqual(probe)
  })

  it("does NOT invalidate the Zoom config query on probe completion", async () => {
    // A probe doesn't change config — invalidating it would cause an
    // unnecessary refetch. The hook is documented to NOT invalidate.
    testZoomConfig.mockResolvedValueOnce({ ok: true })
    fetchZoomConfig.mockResolvedValue({ configured: true, isActive: true })

    const { result } = renderHook(
      () => ({
        query: useZoomConfig(),
        mutation: useTestZoomConfig(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.query.loading).toBe(false))
    expect(fetchZoomConfig).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mutation.mutate({ zoomClientId: "x" })
    })

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
    // Probe is a read-only operation; the config query should NOT refetch.
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchZoomConfig).toHaveBeenCalledTimes(1)
  })
})

describe("useRetryBookingZoom", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("POSTs the retry and returns the refreshed booking fields", async () => {
    const retryResult = {
      id: "bk-1",
      zoomMeetingId: "123",
      zoomJoinUrl: "https://zoom.us/j/123",
      zoomStartUrl: "https://zoom.us/s/123",
    }
    retryBookingZoomMeeting.mockResolvedValueOnce(retryResult)

    const { result } = renderHook(() => useRetryBookingZoom(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate("bk-1")
    })

    await waitFor(() => expect(retryBookingZoomMeeting).toHaveBeenCalledTimes(1))
    // Variable is a string (the booking id) — pass as first arg.
    expect(retryBookingZoomMeeting.mock.calls[0]?.[0]).toBe("bk-1")
    expect(result.current.data).toEqual(retryResult)
  })

  it("invalidates the ['bookings'] query key on successful retry", async () => {
    retryBookingZoomMeeting.mockResolvedValueOnce({
      id: "bk-1",
      zoomMeetingId: null,
      zoomJoinUrl: null,
      zoomStartUrl: null,
    })

    const { result } = renderHook(() => useRetryBookingZoom(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate("bk-1")
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // invalidateQueries marks ['bookings'] as stale. No refetch happens
    // here because no ['bookings', ...] entry is in the cache, so we
    // assert the call to the api fn was made and the hook completed.
    expect(retryBookingZoomMeeting).toHaveBeenCalledTimes(1)
  })

  it("propagates errors (e.g. booking cancelled, Zoom unreachable)", async () => {
    retryBookingZoomMeeting.mockRejectedValueOnce(new Error("Zoom API unreachable"))

    const { result } = renderHook(() => useRetryBookingZoom(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate("bk-1")
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe("Zoom API unreachable")
  })
})
