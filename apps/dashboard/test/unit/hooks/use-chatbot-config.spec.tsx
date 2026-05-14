import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchKnowledgeBase,
  fetchKnowledgeFiles,
  fetchChatbotConfig,
  fetchChatbotConfigByCategory,
} = vi.hoisted(() => ({
  fetchKnowledgeBase: vi.fn(),
  fetchKnowledgeFiles: vi.fn(),
  fetchChatbotConfig: vi.fn(),
  fetchChatbotConfigByCategory: vi.fn(),
}))

vi.mock("@/lib/api/chatbot-kb", () => ({
  fetchKnowledgeBase,
  fetchKnowledgeFiles,
}))

vi.mock("@/lib/api/chatbot", () => ({
  fetchChatbotConfig,
  fetchChatbotConfigByCategory,
  fetchChatSessions: vi.fn(),
  fetchChatSession: vi.fn(),
}))

import {
  useKnowledgeBase,
  useKnowledgeFiles,
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
    fetchKnowledgeBase.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useKnowledgeBase(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchKnowledgeBase).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.entries).toEqual(items)
  })

  it("returns empty entries and hasFilters false by default", async () => {
    fetchKnowledgeBase.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useKnowledgeBase(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.entries).toEqual([])
    expect(result.current.hasFilters).toBe(false)
  })
})

describe("useKnowledgeFiles", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches knowledge files", async () => {
    const items = [{ id: "f-1", filename: "manual.pdf" }]
    fetchKnowledgeFiles.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useKnowledgeFiles(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchKnowledgeFiles).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }))
    expect(result.current.files).toEqual(items)
  })

  it("returns empty files while loading", () => {
    fetchKnowledgeFiles.mockReturnValueOnce(new Promise(() => undefined))
    const { result } = renderHook(() => useKnowledgeFiles(), { wrapper: makeWrapper() })
    expect(result.current.loading).toBe(true)
    expect(result.current.files).toEqual([])
  })
})

describe("useChatbotConfig", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches all config when no category given", async () => {
    const config = [{ key: "greeting", value: "Hello" }]
    fetchChatbotConfig.mockResolvedValueOnce(config)

    const { result } = renderHook(() => useChatbotConfig(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchChatbotConfig).toHaveBeenCalled()
    expect(fetchChatbotConfigByCategory).not.toHaveBeenCalled()
    expect(result.current.config).toEqual(config)
  })

  it("fetches config by category when category is provided", async () => {
    const config = [{ key: "tone", value: "formal" }]
    fetchChatbotConfig.mockResolvedValueOnce(config)

    const { result } = renderHook(() => useChatbotConfig("general"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchChatbotConfig).toHaveBeenCalledWith("general")
    expect(result.current.config).toEqual(config)
  })
})
