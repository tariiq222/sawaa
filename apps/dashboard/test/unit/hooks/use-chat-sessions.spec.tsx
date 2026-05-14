import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchChatSessions, fetchChatSession } = vi.hoisted(() => ({
  fetchChatSessions: vi.fn(),
  fetchChatSession: vi.fn(),
}))

vi.mock("@/lib/api/chatbot", () => ({
  fetchChatSessions,
  fetchChatSession,
  fetchKnowledgeBase: vi.fn(),
  fetchKnowledgeFiles: vi.fn(),
  fetchChatbotConfig: vi.fn(),
  fetchChatbotConfigByCategory: vi.fn(),
}))

import { useChatSessions, useChatSession } from "@/hooks/use-chat-sessions"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useChatSessions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches sessions list and returns items", async () => {
    const items = [{ id: "s-1", clientName: "Ali" }]
    fetchChatSessions.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useChatSessions(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchChatSessions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.sessions).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns empty sessions while loading", () => {
    fetchChatSessions.mockReturnValueOnce(new Promise(() => undefined))
    const { result } = renderHook(() => useChatSessions(), { wrapper: makeWrapper() })
    expect(result.current.loading).toBe(true)
    expect(result.current.sessions).toEqual([])
  })

  it("returns empty sessions on empty result", async () => {
    fetchChatSessions.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useChatSessions(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sessions).toEqual([])
    expect(result.current.hasFilters).toBe(false)
  })

  it("setFilters updates query params and resets page to 1", async () => {
    fetchChatSessions.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useChatSessions(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    ;(result.current.setFilters as (_f: unknown) => void)({ language: "ar" })

    await waitFor(() =>
      expect(fetchChatSessions).toHaveBeenCalledWith(
        expect.objectContaining({ language: "ar", page: 1 }),
      ),
    )
    expect(result.current.hasFilters).toBe(true)
  })
})

describe("useChatSession", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches a single session by id", async () => {
    const session = { id: "s-1", messages: [] }
    fetchChatSession.mockResolvedValueOnce(session)

    const { result } = renderHook(() => useChatSession("s-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchChatSession).toHaveBeenCalledWith("s-1")
    expect(result.current.session).toEqual(session)
  })

  it("does not fetch when id is empty string", () => {
    const { result } = renderHook(() => useChatSession(""), { wrapper: makeWrapper() })

    expect(fetchChatSession).not.toHaveBeenCalled()
    expect(result.current.session).toBeNull()
  })
})
