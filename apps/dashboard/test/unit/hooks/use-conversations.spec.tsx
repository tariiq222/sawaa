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
}))

vi.mock("@/lib/api/conversations", () => apiMocks)

import { useConversations } from "@/hooks/use-conversations"
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
  beforeEach(() => vi.clearAllMocks())

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

  it("keeps a 409 claim conflict available to the UI", async () => {
    const conflict = Object.assign(new Error("already claimed"), { status: 409 })
    apiMocks.claimConversation.mockRejectedValue(conflict)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useConversationMutations(), { wrapper: Wrapper })

    await expect(result.current.claim.mutateAsync({ conversationId: "conversation-1" })).rejects.toBe(conflict)
  })
})
