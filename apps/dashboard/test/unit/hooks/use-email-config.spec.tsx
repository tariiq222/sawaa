/**
 * useEmailConfig — TanStack Query hook unit tests.
 *
 * Contract under test:
 *   - useEmailConfig: read query under ['email','config'], 60s stale,
 *     exposes { config, loading, error }.
 *   - useUpsertEmailConfig: POST via upsertEmailConfig, invalidates
 *     ['email','config'] on success.
 *   - useTestEmail: POST via sendTestEmail — the mutation input is the
 *     recipient address string (the hook does NOT wrap it). The mutation
 *     invalidates ['email','config'] on success so the lastTestAt /
 *     lastTestOk fields refresh immediately.
 */

import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchEmailConfig,
  sendTestEmail,
  upsertEmailConfig,
} = vi.hoisted(() => ({
  fetchEmailConfig: vi.fn(),
  sendTestEmail: vi.fn(),
  upsertEmailConfig: vi.fn(),
}))

vi.mock("@/lib/api/email-config", () => ({
  fetchEmailConfig,
  sendTestEmail,
  upsertEmailConfig,
}))

import {
  useEmailConfig,
  useUpsertEmailConfig,
  useTestEmail,
} from "@/hooks/use-email-config"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

const SAMPLE_CONFIG = {
  id: "ec-1",
  organizationId: "org-1",
  provider: "RESEND" as const,
  senderName: "Sawaa",
  senderEmail: "no-reply@sawaa.sa",
  credentialsConfigured: true,
  lastTestAt: null,
  lastTestOk: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
}

describe("useEmailConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches the email provider config view", async () => {
    fetchEmailConfig.mockResolvedValueOnce(SAMPLE_CONFIG)

    const { result } = renderHook(() => useEmailConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchEmailConfig).toHaveBeenCalledTimes(1)
    expect(result.current.config).toEqual(SAMPLE_CONFIG)
    expect(result.current.error).toBeNull()
  })

  it("surfaces a friendly error message when the backend rejects the fetch", async () => {
    fetchEmailConfig.mockRejectedValueOnce(new Error("Forbidden"))

    const { result } = renderHook(() => useEmailConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error).toBe("Forbidden")
  })
})

describe("useUpsertEmailConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("POSTs the input verbatim and returns the refreshed view", async () => {
    const input = {
      provider: "RESEND" as const,
      senderName: "Sawaa",
      senderEmail: "no-reply@sawaa.sa",
      resend: { apiKey: "re_xxxx" },
    }
    upsertEmailConfig.mockResolvedValueOnce(SAMPLE_CONFIG)

    const { result } = renderHook(() => useUpsertEmailConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate(input)
    })

    await waitFor(() => expect(upsertEmailConfig).toHaveBeenCalledTimes(1))
    expect(upsertEmailConfig.mock.calls[0]?.[0]).toEqual(input)
    expect(result.current.data).toEqual(SAMPLE_CONFIG)
  })

  it("invalidates ['email','config'] on successful upsert", async () => {
    upsertEmailConfig.mockResolvedValueOnce(SAMPLE_CONFIG)
    fetchEmailConfig.mockResolvedValue(SAMPLE_CONFIG)

    const { result } = renderHook(
      () => ({
        query: useEmailConfig(),
        mutation: useUpsertEmailConfig(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.query.loading).toBe(false))
    expect(fetchEmailConfig).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mutation.mutate({ provider: "NONE" as const })
    })

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
    await waitFor(() => expect(fetchEmailConfig).toHaveBeenCalledTimes(2))
  })

  it("propagates api-layer errors", async () => {
    upsertEmailConfig.mockRejectedValueOnce(new Error("Validation failed"))

    const { result } = renderHook(() => useUpsertEmailConfig(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ provider: "RESEND" as const })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe("Validation failed")
  })
})

describe("useTestEmail", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("passes the recipient string as the mutation input (no wrapping)", async () => {
    const probeResult = { ok: true, messageId: "msg-1" }
    sendTestEmail.mockResolvedValueOnce(probeResult)

    const { result } = renderHook(() => useTestEmail(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate("test@sawaa.sa")
    })

    await waitFor(() => expect(sendTestEmail).toHaveBeenCalledTimes(1))
    expect(sendTestEmail.mock.calls[0]?.[0]).toBe("test@sawaa.sa")
    expect(result.current.data).toEqual(probeResult)
  })

  it("invalidates ['email','config'] on successful test send", async () => {
    sendTestEmail.mockResolvedValueOnce({ ok: true, messageId: "m" })
    fetchEmailConfig.mockResolvedValue(SAMPLE_CONFIG)

    const { result } = renderHook(
      () => ({
        query: useEmailConfig(),
        mutation: useTestEmail(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.query.loading).toBe(false))
    expect(fetchEmailConfig).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mutation.mutate("test@sawaa.sa")
    })

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
    await waitFor(() => expect(fetchEmailConfig).toHaveBeenCalledTimes(2))
  })

  it("propagates api errors", async () => {
    sendTestEmail.mockRejectedValueOnce(new Error("Timeout"))

    const { result } = renderHook(() => useTestEmail(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate("test@sawaa.sa")
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe("Timeout")
  })
})
