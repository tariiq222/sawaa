import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  uploadKnowledgeFile,
  processKnowledgeFile,
  deleteKnowledgeFile,
} = vi.hoisted(() => ({
  createKnowledgeEntry: vi.fn(),
  updateKnowledgeEntry: vi.fn(),
  deleteKnowledgeEntry: vi.fn(),
  syncKnowledgeBase: vi.fn(),
  uploadKnowledgeFile: vi.fn(),
  processKnowledgeFile: vi.fn(),
  deleteKnowledgeFile: vi.fn(),
}))

vi.mock("@/lib/api/chatbot-kb", () => ({
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  uploadKnowledgeFile,
  processKnowledgeFile,
  deleteKnowledgeFile,
  fetchKnowledgeBase: vi.fn(),
  fetchKnowledgeFiles: vi.fn(),
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

  it("createKbEntryMut calls createKnowledgeEntry", async () => {
    createKnowledgeEntry.mockResolvedValueOnce({ id: "kb-new" })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createKbEntryMut.mutate(
        { title: "FAQ", content: "..." } as Parameters<typeof createKnowledgeEntry>[0],
      )
    })

    await waitFor(() =>
      expect(createKnowledgeEntry).toHaveBeenCalledWith(
        expect.objectContaining({ title: "FAQ" }),
      ),
    )
  })

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
        payload: { content: "updated" },
      })
    })

    await waitFor(() =>
      expect(updateKnowledgeEntry).toHaveBeenCalledWith(
        "kb-1",
        expect.objectContaining({ content: "updated" }),
      ),
    )
  })

  it("syncKbMut calls syncKnowledgeBase", async () => {
    syncKnowledgeBase.mockResolvedValueOnce({ synced: 3 })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.syncKbMut.mutate(undefined) })

    await waitFor(() => expect(syncKnowledgeBase).toHaveBeenCalled())
  })

  it("deleteFileMut calls deleteKnowledgeFile with id", async () => {
    deleteKnowledgeFile.mockResolvedValueOnce({ deleted: true })

    const { result } = renderHook(() => useChatbotMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteFileMut.mutate("file-1") })

    await waitFor(() =>
      expect(deleteKnowledgeFile).toHaveBeenCalledWith("file-1"),
    )
  })
})
