import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const apiMocks = vi.hoisted(() => ({
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  fetchConversationMessages: vi.fn(),
  claimConversation: vi.fn(),
  replyToConversation: vi.fn(),
  assignConversation: vi.fn(),
  releaseConversation: vi.fn(),
  closeConversation: vi.fn(),
  markConversationRead: vi.fn(),
  isConversationClaimConflict: (error: unknown) => Boolean(error && typeof error === "object" && "status" in error && error.status === 409),
}))

vi.mock("@/lib/api/conversations", () => apiMocks)

import { useConversationMessages, useConversations } from "@/hooks/use-conversations"
import { useConversationMutations } from "@/hooks/use-conversation-mutations"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, queryClient }
}

describe("useConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.fetchConversations.mockReset()
    apiMocks.fetchConversationMessages.mockReset()
  })

  it("fetches the requested filters", async () => {
    apiMocks.fetchConversations.mockResolvedValue({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } })
    const filters = { status: "AI_ACTIVE" as const, unreadOnly: true }
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useConversations(filters), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiMocks.fetchConversations).toHaveBeenCalledWith(filters)
  })

  it("polls the reception inbox every 7.5 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      apiMocks.fetchConversations.mockResolvedValue({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } })
      const { Wrapper } = makeWrapper()
      renderHook(() => useConversations(), { wrapper: Wrapper })
      await waitFor(() => expect(apiMocks.fetchConversations).toHaveBeenCalledTimes(1))

      await act(async () => {
        vi.advanceTimersByTime(7_500)
        await Promise.resolve()
      })

      await waitFor(() => expect(apiMocks.fetchConversations).toHaveBeenCalledTimes(2))
    } finally {
      vi.useRealTimers()
    }
  })

  it("loads the next inbox page with the server cursor and preserves filters", async () => {
    apiMocks.fetchConversations
      .mockResolvedValueOnce({ data: [{ id: "conversation-1" }], meta: { limit: 1, hasMore: true, nextCursor: "conversation-1" } })
      .mockResolvedValueOnce({ data: [{ id: "conversation-2" }], meta: { limit: 1, hasMore: false, nextCursor: null } })
    const filters = { status: "WAITING_FOR_STAFF" as const, limit: 1 }
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useConversations(filters), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    let nextResult: Awaited<ReturnType<typeof result.current.fetchNextPage>> | undefined
    await act(async () => { nextResult = await result.current.fetchNextPage() })

    expect(apiMocks.fetchConversations).toHaveBeenNthCalledWith(2, { ...filters, cursor: "conversation-1" })
    expect(nextResult?.data?.pages).toHaveLength(2)
  })

  it("loads older messages through the message cursor", async () => {
    apiMocks.fetchConversationMessages
      .mockResolvedValueOnce({ data: [{ id: "message-2" }], meta: { limit: 1, hasMore: true, nextCursor: "message-2" } })
      .mockResolvedValueOnce({ data: [{ id: "message-1" }], meta: { limit: 1, hasMore: false, nextCursor: null } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useConversationMessages("conversation-1", { limit: 1 }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    let nextResult: Awaited<ReturnType<typeof result.current.fetchNextPage>> | undefined
    await act(async () => { nextResult = await result.current.fetchNextPage() })

    expect(apiMocks.fetchConversationMessages).toHaveBeenNthCalledWith(2, "conversation-1", { limit: 1, cursor: "message-2" })
    expect(nextResult?.data?.pages).toHaveLength(2)
  })
})

describe("useConversationMutations", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ["claim", { conversationId: "conversation-1" }, "claimConversation"],
    ["reply", { conversationId: "conversation-1", body: "مرحباً" }, "replyToConversation"],
    ["release", { conversationId: "conversation-1" }, "releaseConversation"],
    ["close", { conversationId: "conversation-1" }, "closeConversation"],
  ] as const)("invalidates the inbox after %s", async (mutationName, input, apiName) => {
    apiMocks[apiName].mockResolvedValue({})
    const { Wrapper, queryClient } = makeWrapper()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useConversationMutations(), { wrapper: Wrapper })

    await result.current[mutationName].mutateAsync(input as never)

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["conversations"] })
  })

  it("keeps a 409 claim conflict available and immediately refreshes conversation caches", async () => {
    const conflict = Object.assign(new Error("already claimed"), { status: 409 })
    apiMocks.claimConversation.mockRejectedValue(conflict)
    const { Wrapper, queryClient } = makeWrapper()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useConversationMutations(), { wrapper: Wrapper })

    await expect(result.current.claim.mutateAsync({ conversationId: "conversation-1" })).rejects.toBe(conflict)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["conversations"] })
  })
})
