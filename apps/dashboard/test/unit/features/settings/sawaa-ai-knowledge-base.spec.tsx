import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SawaaAiKnowledgeBase } from "@/components/features/settings/sawaa-ai-knowledge-base"
import type { KnowledgeEntry } from "@/lib/api/sawaa-ai-knowledge-base"

type MockDetail = KnowledgeEntry & { content?: string | null; chunks?: Array<{ id: string; chunkIndex: number; tokenCount: number }> }

const mock = vi.hoisted(() => ({
  page: { pages: [{ data: [] as KnowledgeEntry[], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }] },
  listLoading: false,
  listError: false,
  detailById: {} as Record<string, MockDetail>,
  detailLoading: false,
  detailError: false,
  canManage: true,
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  mutations: {
    create: { mutateAsync: vi.fn(), isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
    publish: { mutateAsync: vi.fn(), isPending: false },
    unpublish: { mutateAsync: vi.fn(), isPending: false },
    reindex: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  },
}))

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ canDo: () => mock.canManage }) }))
vi.mock("@/hooks/use-sawaa-ai-knowledge-base", () => ({
  useSawaaAiKnowledge: () => ({ data: mock.page, isLoading: mock.listLoading, isError: mock.listError, isFetchingNextPage: false, hasNextPage: Boolean(mock.page.pages.at(-1) && mock.page.pages.at(-1)!.meta.page < mock.page.pages.at(-1)!.meta.totalPages), refetch: mock.refetch, fetchNextPage: mock.fetchNextPage }),
  useSawaaAiKnowledgeDetail: (id: string | null) => ({ data: id ? mock.detailById[id] ?? null : null, isLoading: mock.detailLoading, isError: mock.detailError, refetch: mock.refetch }),
  useSawaaAiKnowledgeMutations: () => mock.mutations,
}))

function entry(id: string, overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return { id, title: `Entry ${id}`, sourceType: "manual", sourceRef: null, status: "PENDING", isPublished: false, publishedAt: null, lastIndexedAt: null, lastIndexErrorCode: null, metadata: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", ...overrides }
}

function setPage(data: KnowledgeEntry[], totalPages = 1, page = 1) {
  mock.page = { pages: [{ data, meta: { total: data.length, page, limit: 20, totalPages } }] }
}

describe("Sawaa Ai knowledge base", () => {
  beforeEach(() => {
    setPage([])
    mock.listLoading = false; mock.listError = false; mock.detailLoading = false; mock.detailError = false; mock.canManage = true; mock.detailById = {}
    mock.refetch.mockReset(); mock.fetchNextPage.mockReset()
    for (const mutation of Object.values(mock.mutations)) { mutation.mutateAsync.mockReset().mockResolvedValue({}); mutation.isPending = false }
    vi.stubGlobal("confirm", vi.fn(() => true))
  })

  it("renders initial loading, retryable error, and empty states", () => {
    mock.listLoading = true
    const { rerender } = render(<SawaaAiKnowledgeBase />)
    expect(screen.getByText("common.loading")).toBeInTheDocument()
    mock.listLoading = false; mock.listError = true; rerender(<SawaaAiKnowledgeBase />)
    expect(screen.getByRole("alert")).toHaveTextContent("sawaaAi.knowledge.loadFailed")
    fireEvent.click(screen.getByRole("button", { name: "common.retry" })); expect(mock.refetch).toHaveBeenCalled()
    mock.listError = false; rerender(<SawaaAiKnowledgeBase />)
    expect(screen.getByText("sawaaAi.knowledge.empty")).toBeInTheDocument()
  })

  it("creates a manual entry with its body", async () => {
    render(<SawaaAiKnowledgeBase />)
    fireEvent.change(screen.getByLabelText("sawaaAi.knowledge.titleField"), { target: { value: "Hours" } })
    fireEvent.change(screen.getByLabelText("sawaaAi.knowledge.contentField"), { target: { value: "We open at 9" } })
    fireEvent.click(screen.getByRole("button", { name: "sawaaAi.knowledge.create" }))
    await waitFor(() => expect(mock.mutations.create.mutateAsync).toHaveBeenCalledWith({ title: "Hours", content: "We open at 9", sourceType: "manual" }))
  })

  it("fetches detail before edit/preview and ignores stale A after selecting B", async () => {
    const a = entry("a", { content: "A secret body" }); const b = entry("b", { content: "B body" })
    setPage([a, b]); mock.detailById = { a: { ...a, chunks: [{ id: "chunk-a", chunkIndex: 0, tokenCount: 2 }] }, b: { ...b, chunks: [] } }
    const { rerender } = render(<SawaaAiKnowledgeBase />)
    fireEvent.click(screen.getByRole("button", { name: /Entry a/ }));
    expect(screen.queryAllByText("A secret body").length).toBeGreaterThanOrEqual(1)
    rerender(<SawaaAiKnowledgeBase />)
    await waitFor(() => expect(screen.getAllByText("A secret body").length).toBeGreaterThanOrEqual(1))
    fireEvent.click(screen.getByRole("button", { name: /Entry b/ }));
    rerender(<SawaaAiKnowledgeBase />)
    await waitFor(() => expect(screen.getAllByText("B body").length).toBeGreaterThanOrEqual(1))
    expect(screen.queryByText("A secret body")).not.toBeInTheDocument()
  })

  it("updates using fetched detail content rather than list summary", async () => {
    const item = entry("a"); setPage([item]); mock.detailById = { a: { ...item, content: "Fetched body" } }
    render(<SawaaAiKnowledgeBase />)
    fireEvent.click(screen.getByRole("button", { name: /Entry a/ }))
    await waitFor(() => expect(screen.getByDisplayValue("Fetched body")).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText("sawaaAi.knowledge.titleField"), { target: { value: "Updated" } })
    fireEvent.click(screen.getByRole("button", { name: "sawaaAi.knowledge.update" }))
    await waitFor(() => expect(mock.mutations.update.mutateAsync).toHaveBeenCalledWith({ id: "a", input: { title: "Updated", content: "Fetched body", sourceType: "manual", sourceRef: undefined } }))
  })

  it("runs publish, unpublish, and reindex actions independently", async () => {
    const draft = entry("draft"); const published = entry("pub", { isPublished: true }); setPage([draft, published])
    render(<SawaaAiKnowledgeBase />)
    fireEvent.click(screen.getByRole("button", { name: "sawaaAi.knowledge.publish" })); fireEvent.click(screen.getByRole("button", { name: "sawaaAi.knowledge.unpublish" })); fireEvent.click(screen.getAllByRole("button", { name: "sawaaAi.knowledge.reindex" })[0])
    await waitFor(() => { expect(mock.mutations.publish.mutateAsync).toHaveBeenCalledWith("draft"); expect(mock.mutations.unpublish.mutateAsync).toHaveBeenCalledWith("pub"); expect(mock.mutations.reindex.mutateAsync).toHaveBeenCalledWith("draft") })
  })

  it("confirms delete and supports cancellation", async () => {
    const item = entry("a"); setPage([item]); render(<SawaaAiKnowledgeBase />)
    vi.mocked(confirm).mockReturnValueOnce(false); fireEvent.click(screen.getByRole("button", { name: "sawaaAi.knowledge.delete" })); expect(mock.mutations.remove.mutateAsync).not.toHaveBeenCalled()
    vi.mocked(confirm).mockReturnValueOnce(true); fireEvent.click(screen.getByRole("button", { name: "sawaaAi.knowledge.delete" })); await waitFor(() => expect(mock.mutations.remove.mutateAsync).toHaveBeenCalledWith("a"))
  })

  it("loads further pages through the infinite query without duplicating rows", () => {
    setPage([entry("a"), entry("b")], 2); const { rerender } = render(<SawaaAiKnowledgeBase />)
    fireEvent.click(screen.getByRole("button", { name: "sawaaAi.knowledge.loadMore" })); expect(mock.fetchNextPage).toHaveBeenCalledTimes(1)
    setPage([entry("a"), entry("b"), entry("c")], 2, 2); rerender(<SawaaAiKnowledgeBase />); expect(screen.getAllByRole("button", { name: /Entry/ })).toHaveLength(3)
  })

  it("shows detail failure with retry and never renders raw errors or embeddings", () => {
    const item = entry("a", { status: "FAILED", lastIndexErrorCode: "EMBEDDING_PROVIDER_BODY", metadata: { embedding: [1, 2] } }); setPage([item]); mock.detailError = true
    render(<SawaaAiKnowledgeBase />); fireEvent.click(screen.getByRole("button", { name: /Entry a/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("sawaaAi.knowledge.detailFailed"); expect(screen.queryByText(/EMBEDDING_PROVIDER_BODY|embedding/)).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "common.retry" })); expect(mock.refetch).toHaveBeenCalled()
  })

  it("keeps read-only users able to preview bounded detail but hides mutations", async () => {
    mock.canManage = false; const item = entry("a", { isPublished: true, status: "EMBEDDED" }); setPage([item]); mock.detailById = { a: { ...item, content: "safe preview" } }
    render(<SawaaAiKnowledgeBase />); expect(screen.queryByRole("button", { name: "sawaaAi.knowledge.create" })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: /Entry a/ })); await waitFor(() => expect(screen.getByText("safe preview")).toBeInTheDocument()); expect(screen.queryByRole("button", { name: "sawaaAi.knowledge.publish" })).not.toBeInTheDocument(); expect(screen.getByText(/sawaaAi\.knowledge\.published/)).toBeInTheDocument(); expect(screen.getByText(/sawaaAi\.knowledge\.index\.embedded/)).toBeInTheDocument()
  })
})
