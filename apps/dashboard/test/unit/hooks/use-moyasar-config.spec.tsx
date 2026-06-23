/**
 * useMoyasarConfig — TanStack Query hook unit tests.
 *
 * Contract under test:
 *   - useMoyasarConfig → read query, 60s stale, calls fetchMoyasarConfig.
 *   - useUpsertMoyasarConfig → mutation that POSTs via upsertMoyasarConfig
 *     and invalidates the ['moyasar','config'] key on success.
 *   - useTestMoyasarConfig → mutation that POSTs via testMoyasarConfig
 *     and invalidates the same key on success (so the upserted config is
 *     immediately re-fetched after a probe).
 *   - All three reject when the api layer throws (write-only contract —
 *     a leaked PATCH failure would silently corrupt the credentials).
 */

import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchMoyasarConfig,
  testMoyasarConfig,
  upsertMoyasarConfig,
} = vi.hoisted(() => ({
  fetchMoyasarConfig: vi.fn(),
  testMoyasarConfig: vi.fn(),
  upsertMoyasarConfig: vi.fn(),
}))

vi.mock("@/lib/api/moyasar-config", () => ({
  fetchMoyasarConfig,
  testMoyasarConfig,
  upsertMoyasarConfig,
}))

import {
  useMoyasarConfig,
  useUpsertMoyasarConfig,
  useTestMoyasarConfig,
} from "@/hooks/use-moyasar-config"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useMoyasarConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches Moyasar config and returns it as data", async () => {
    const config = {
      publishableKey: "pk_test_abc",
      secretKeyMasked: "sk_test_****abc",
      hasWebhookSecret: true,
      isLive: false,
      lastVerifiedAt: null,
      lastVerifiedStatus: null,
      updatedAt: "2026-06-01T00:00:00.000Z",
    }
    fetchMoyasarConfig.mockResolvedValueOnce(config)

    const { result } = renderHook(() => useMoyasarConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchMoyasarConfig).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(config)
  })

  it("returns the trimmed view shape (write-only — no raw secretKey)", async () => {
    const trimmed = {
      publishableKey: "pk_test_xxx",
      isLive: false,
      updatedAt: "2026-06-01T00:00:00.000Z",
    }
    fetchMoyasarConfig.mockResolvedValueOnce(trimmed)

    const { result } = renderHook(() => useMoyasarConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).not.toHaveProperty("secretKey")
    expect(result.current.data).not.toHaveProperty("webhookSecret")
  })

  it("propagates api errors to the error field", async () => {
    fetchMoyasarConfig.mockRejectedValueOnce(new Error("Forbidden"))

    const { result } = renderHook(() => useMoyasarConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe("Forbidden")
  })
})

describe("useUpsertMoyasarConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls upsertMoyasarConfig with the input and returns the trimmed view", async () => {
    upsertMoyasarConfig.mockResolvedValueOnce({
      publishableKey: "pk_test_new",
      isLive: true,
      updatedAt: "2026-06-02T00:00:00.000Z",
    })

    const { result } = renderHook(() => useUpsertMoyasarConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({
        publishableKey: "pk_test_new",
        secretKey: "sk_test_new",
        isLive: true,
      })
    })

    await waitFor(() => expect(upsertMoyasarConfig).toHaveBeenCalledTimes(1))
    // TanStack Query v5 calls mutationFn(variables, context) — variables
    // are always the first positional arg.
    expect(upsertMoyasarConfig.mock.calls[0]?.[0]).toEqual({
      publishableKey: "pk_test_new",
      secretKey: "sk_test_new",
      isLive: true,
    })
    expect(result.current.data).toEqual({
      publishableKey: "pk_test_new",
      isLive: true,
      updatedAt: "2026-06-02T00:00:00.000Z",
    })
  })

  it("invalidates the ['moyasar','config'] query on success (refetches the read query)", async () => {
    // Render both the read and the mutation hook in the same QueryClient so
    // the cache entry actually exists to invalidate.
    upsertMoyasarConfig.mockResolvedValueOnce({
      publishableKey: "pk_test_new",
      isLive: true,
      updatedAt: "2026-06-02T00:00:00.000Z",
    })
    // Initial fetch + post-invalidation refetch.
    fetchMoyasarConfig.mockResolvedValue({
      publishableKey: "pk_test_new",
      isLive: true,
      updatedAt: "2026-06-02T00:00:00.000Z",
    })

    const { result } = renderHook(
      () => ({
        query: useMoyasarConfig(),
        mutation: useUpsertMoyasarConfig(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.query.isLoading).toBe(false))
    expect(fetchMoyasarConfig).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mutation.mutate({ publishableKey: "pk_test_new" })
    })

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
    // invalidateQueries → refetch on the existing cache entry.
    await waitFor(() => expect(fetchMoyasarConfig).toHaveBeenCalledTimes(2))
  })

  it("propagates api errors and surfaces them in mutation.error", async () => {
    const apiError = new Error("Validation failed")
    upsertMoyasarConfig.mockRejectedValueOnce(apiError)

    const { result } = renderHook(() => useUpsertMoyasarConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ publishableKey: "bad" })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(apiError)
  })
})

describe("useTestMoyasarConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls testMoyasarConfig and returns the probe result", async () => {
    const probeResult = { ok: true, status: "OK" }
    testMoyasarConfig.mockResolvedValueOnce(probeResult)

    const { result } = renderHook(() => useTestMoyasarConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(testMoyasarConfig).toHaveBeenCalledTimes(1))
    expect(result.current.data).toEqual(probeResult)
  })

  it("invalidates the read query on a successful probe so lastTestAt refreshes", async () => {
    testMoyasarConfig.mockResolvedValueOnce({ ok: true, status: "OK" })
    fetchMoyasarConfig.mockResolvedValue({
      publishableKey: "pk_test_x",
      isLive: false,
      updatedAt: "2026-06-02T00:00:00.000Z",
    })

    const { result } = renderHook(
      () => ({
        query: useMoyasarConfig(),
        mutation: useTestMoyasarConfig(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.query.isLoading).toBe(false))
    expect(fetchMoyasarConfig).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mutation.mutate()
    })

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
    await waitFor(() => expect(fetchMoyasarConfig).toHaveBeenCalledTimes(2))
  })

  it("propagates network errors", async () => {
    testMoyasarConfig.mockRejectedValueOnce(new Error("Timeout"))

    const { result } = renderHook(() => useTestMoyasarConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})
