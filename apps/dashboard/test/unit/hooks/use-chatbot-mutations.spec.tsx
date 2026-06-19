import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
} = vi.hoisted(() => ({
  updateKnowledgeEntry: vi.fn(),
  deleteKnowledgeEntry: vi.fn(),
}))

vi.mock("@/lib/api/chatbot-kb", () => ({
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  fetchKnowledgeBase: vi.fn(),
}))

vi.mock("@/lib/api/chatbot", () => ({
  endChatSession: vi.fn(),
  sendStaffMessage: vi.fn(),
  upsertChatbotConfig: vi.fn(),
}))

import { useChatbotMutations } from "@/hooks/use-chatbot-mutations"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useChatbotMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("deleteKbEntryMut calls deleteKnowledgeEntry with id", async () => {
    deleteKnowledgeEntry.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteKbEntryMut.mutate("kb-1") })

    await waitFor(() =>
      expect(deleteKnowledgeEntry).toHaveBeenCalledWith("kb-1"),
    )
  })

  it("updateKbEntryMut calls updateKnowledgeEntry with id and payload", async () => {
    updateKnowledgeEntry.mockResolvedValueOnce({ id: "kb-1" })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateKbEntryMut.mutate({
        id: "kb-1",
        payload: { title: "updated" },
      })
    })

    await waitFor(() =>
      expect(updateKnowledgeEntry).toHaveBeenCalledWith(
        "kb-1",
        expect.objectContaining({ title: "updated" }),
      ),
    )
  })
})
