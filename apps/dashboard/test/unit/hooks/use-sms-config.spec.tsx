/**
 * useSmsConfig — TanStack Query hook unit tests.
 *
 * Contract under test:
 *   - useSmsConfig: read query under ['sms','config'], 60s stale, exposes
 *     { config, loading, error }.
 *   - useSmsDeliveries: read query under ['sms','deliveries'], 30s stale,
 *     exposes { deliveries, loading, error, refetch }. A failing fetch
 *     must surface an error string, not crash the hook.
 *   - useUpsertSmsConfig: POST via upsertSmsConfig, invalidates
 *     ['sms','config'] only (NOT deliveries).
 *   - useTestSms: POSTs the recipient phone and invalidates BOTH
 *     ['sms','config'] AND ['sms','deliveries'] because a test send creates
 *     a new delivery row that the deliveries list must show.
 *   - Send-target contract: the mutation input is the phone number string,
 *     not a nested object — a regression wrapping it in `{toPhone: ...}`
 *     would 400 the backend.
 */

import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchSmsConfig,
  fetchSmsDeliveries,
  sendTestSms,
  upsertSmsConfig,
} = vi.hoisted(() => ({
  fetchSmsConfig: vi.fn(),
  fetchSmsDeliveries: vi.fn(),
  sendTestSms: vi.fn(),
  upsertSmsConfig: vi.fn(),
}))

vi.mock("@/lib/api/sms", () => ({
  fetchSmsConfig,
  fetchSmsDeliveries,
  sendTestSms,
  upsertSmsConfig,
}))

import {
  useSmsConfig,
  useSmsDeliveries,
  useUpsertSmsConfig,
  useTestSms,
} from "@/hooks/use-sms-config"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

const SAMPLE_CONFIG = {
  provider: "UNIFONIC",
  senderId: "Sawaa",
  credentialsConfigured: true,
  lastTestAt: null,
  lastTestOk: null,
  updatedAt: "2026-06-01T00:00:00.000Z",
}

const SAMPLE_DELIVERY = {
  id: "del-1",
  recipient: "+9665xxxxxxxx",
  body: "test",
  status: "SENT",
  sentAt: "2026-06-01T00:00:00.000Z",
}

describe("useSmsConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches the SMS provider config view", async () => {
    fetchSmsConfig.mockResolvedValueOnce(SAMPLE_CONFIG)

    const { result } = renderHook(() => useSmsConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchSmsConfig).toHaveBeenCalledTimes(1)
    expect(result.current.config).toEqual(SAMPLE_CONFIG)
    expect(result.current.error).toBeNull()
  })

  it("surfaces api errors as a string message", async () => {
    fetchSmsConfig.mockRejectedValueOnce(new Error("Forbidden"))

    const { result } = renderHook(() => useSmsConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error).toBe("Forbidden")
  })
})

describe("useSmsDeliveries", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns the deliveries array, unwrapping the {items} envelope", async () => {
    fetchSmsDeliveries.mockResolvedValueOnce({ items: [SAMPLE_DELIVERY] })

    const { result } = renderHook(() => useSmsDeliveries(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.deliveries).toEqual([SAMPLE_DELIVERY])
  })

  it("returns an empty array when the api returns no items", async () => {
    fetchSmsDeliveries.mockResolvedValueOnce({ items: [] })

    const { result } = renderHook(() => useSmsDeliveries(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.deliveries).toEqual([])
  })

  it("defensive empty array when the api response is missing items", async () => {
    fetchSmsDeliveries.mockResolvedValueOnce({ items: undefined } as unknown as {
      items: typeof SAMPLE_DELIVERY[]
    })

    const { result } = renderHook(() => useSmsDeliveries(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.deliveries).toEqual([])
  })

  it("exposes a working refetch handle", async () => {
    fetchSmsDeliveries.mockResolvedValue({ items: [] })

    const { result } = renderHook(() => useSmsDeliveries(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchSmsDeliveries).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refetch()
    })

    expect(fetchSmsDeliveries).toHaveBeenCalledTimes(2)
  })
})

describe("useUpsertSmsConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("POSTs the input to upsertSmsConfig and returns the refreshed view", async () => {
    upsertSmsConfig.mockResolvedValueOnce(SAMPLE_CONFIG)

    const { result } = renderHook(() => useUpsertSmsConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({
        provider: "UNIFONIC",
        senderId: "Sawaa",
        unifonic: { appSid: "sid", apiKey: "uk_xxx" },
      })
    })

    await waitFor(() => expect(upsertSmsConfig).toHaveBeenCalledTimes(1))
    expect(upsertSmsConfig.mock.calls[0]?.[0]).toEqual({
      provider: "UNIFONIC",
      senderId: "Sawaa",
      unifonic: { appSid: "sid", apiKey: "uk_xxx" },
    })
    expect(result.current.data).toEqual(SAMPLE_CONFIG)
  })

  it("invalidates the SMS config query (but NOT deliveries) on success", async () => {
    upsertSmsConfig.mockResolvedValueOnce(SAMPLE_CONFIG)
    fetchSmsConfig.mockResolvedValue(SAMPLE_CONFIG)
    fetchSmsDeliveries.mockResolvedValue({ items: [] })

    const { result } = renderHook(
      () => ({
        configQuery: useSmsConfig(),
        configMutation: useUpsertSmsConfig(),
        deliveriesQuery: useSmsDeliveries(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.configQuery.loading).toBe(false))
    await waitFor(() => expect(result.current.deliveriesQuery.loading).toBe(false))
    expect(fetchSmsConfig).toHaveBeenCalledTimes(1)
    expect(fetchSmsDeliveries).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.configMutation.mutate({ provider: "UNIFONIC", senderId: "Sawaa" })
    })

    await waitFor(() => expect(result.current.configMutation.isSuccess).toBe(true))
    // Config invalidation triggers a refetch.
    await waitFor(() => expect(fetchSmsConfig).toHaveBeenCalledTimes(2))
    // Deliveries should NOT be refetched by an upsert.
    expect(fetchSmsDeliveries).toHaveBeenCalledTimes(1)
  })
})

describe("useTestSms", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("POSTs the recipient phone number and returns the test result", async () => {
    const probeResult = { ok: true, messageId: "msg-1" }
    sendTestSms.mockResolvedValueOnce(probeResult)

    const { result } = renderHook(() => useTestSms(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate("+9665xxxxxxxx")
    })

    await waitFor(() => expect(sendTestSms).toHaveBeenCalledTimes(1))
    // The hook passes the phone string directly — no nested wrapper.
    expect(sendTestSms.mock.calls[0]?.[0]).toBe("+9665xxxxxxxx")
    expect(result.current.data).toEqual(probeResult)
  })

  it("invalidates BOTH ['sms','config'] and ['sms','deliveries'] on success", async () => {
    sendTestSms.mockResolvedValueOnce({ ok: true, messageId: "m" })
    fetchSmsConfig.mockResolvedValue(SAMPLE_CONFIG)
    fetchSmsDeliveries.mockResolvedValue({ items: [SAMPLE_DELIVERY] })

    const { result } = renderHook(
      () => ({
        configQuery: useSmsConfig(),
        deliveriesQuery: useSmsDeliveries(),
        mutation: useTestSms(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.configQuery.loading).toBe(false))
    await waitFor(() => expect(result.current.deliveriesQuery.loading).toBe(false))
    expect(fetchSmsConfig).toHaveBeenCalledTimes(1)
    expect(fetchSmsDeliveries).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mutation.mutate("+9665xxxxxxxx")
    })

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
    // A test send produces a new delivery row — both keys should refetch.
    await waitFor(() => expect(fetchSmsConfig).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(fetchSmsDeliveries).toHaveBeenCalledTimes(2))
  })

  it("propagates network errors", async () => {
    sendTestSms.mockRejectedValueOnce(new Error("Timeout"))

    const { result } = renderHook(() => useTestSms(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate("+9665xxxxxxxx")
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe("Timeout")
  })
})
