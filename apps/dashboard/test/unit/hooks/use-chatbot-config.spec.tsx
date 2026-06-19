import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchKnowledgeBase,
  fetchChatbotConfig,
} = vi.hoisted(() => ({
  fetchKnowledgeBase: vi.fn(),
  fetchChatbotConfig: vi.fn(),
}))

vi.mock("@/lib/api/chatbot-kb", () => ({
  fetchKnowledgeBase,
}))

vi.mock("@/lib/api/chatbot", () => ({
  fetchChatbotConfig,
  fetchChatSessions: vi.fn(),
  fetchChatSession: vi.fn(),
}))

import {
  useKnowledgeBase,
  useChatbotConfig,
} from "@/hooks/use-chatbot-config"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useKnowledgeBase", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches knowledge base entries", async () => {
    const items = [{ id: "kb-1", title: "FAQ" }]
    fetchKnowledgeBase.mockResolvedValueOnce({ data: items, meta: { total: 1 } })

    const { result } = renderHook(() => useKnowledgeBase(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchKnowledgeBase).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.entries).toEqual(items)
  })

  it("returns empty entries and hasFilters false by default", async () => {
    fetchKnowledgeBase.mockResolvedValueOnce({ data: [], meta: { total: 0 } })

    const { result } = renderHook(() => useKnowledgeBase(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.entries).toEqual([])
    expect(result.current.hasFilters).toBe(false)
  })
})

describe("useChatbotConfig", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches singleton config", async () => {
    const config = { id: "1", systemPromptAr: null, systemPromptEn: null, greetingAr: "مرحبا", greetingEn: "Hello", escalateToHumanAt: null, settings: null, createdAt: "", updatedAt: "" }
    fetchChatbotConfig.mockResolvedValueOnce(config)

    const { result } = renderHook(() => useChatbotConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchChatbotConfig).toHaveBeenCalled()
    expect(result.current.config).toEqual(config)
  })
})
