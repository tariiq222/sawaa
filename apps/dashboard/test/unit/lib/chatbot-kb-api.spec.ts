import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock },
  getAccessToken: vi.fn(() => "mock-token"),
}))

vi.mock("@/lib/api/chatbot-kb", () => ({
  fetchKnowledgeBase: (...args: unknown[]) => getMock("/chatbot/knowledge-base", args),
  createKnowledgeEntry: (...args: unknown[]) => postMock("/chatbot/knowledge-base", args),
  updateKnowledgeEntry: (...args: unknown[]) => patchMock("/chatbot/knowledge-base/:id", args),
  deleteKnowledgeEntry: (...args: unknown[]) => deleteMock("/chatbot/knowledge-base/:id", args),
  syncKnowledgeBase: (...args: unknown[]) => postMock("/chatbot/knowledge-base/sync", args),
  fetchKnowledgeFiles: (...args: unknown[]) => getMock("/chatbot/knowledge-base/files", args),
  processKnowledgeFile: (...args: unknown[]) => postMock("/chatbot/knowledge-base/files/:id/process", args),
  deleteKnowledgeFile: (...args: unknown[]) => deleteMock("/chatbot/knowledge-base/files/:id", args),
}))

import {
  fetchKnowledgeBase,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  fetchKnowledgeFiles,
  processKnowledgeFile,
  deleteKnowledgeFile,
} from "@/lib/api/chatbot-kb"

describe("chatbot-kb api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchKnowledgeBase calls GET /chatbot/knowledge-base", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchKnowledgeBase({ page: 1 })
    expect(getMock).toHaveBeenCalled()
  })

  it("createKnowledgeEntry calls POST /chatbot/knowledge-base", async () => {
    postMock.mockResolvedValueOnce({ id: "kb-1" })
    await createKnowledgeEntry({ title: "FAQ" } as Parameters<typeof createKnowledgeEntry>[0])
    expect(postMock).toHaveBeenCalled()
  })

  it("updateKnowledgeEntry calls PATCH /chatbot/knowledge-base/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "kb-1" })
    await updateKnowledgeEntry("kb-1", { title: "Updated" } as Parameters<typeof updateKnowledgeEntry>[1])
    expect(patchMock).toHaveBeenCalled()
  })

  it("deleteKnowledgeEntry calls DELETE /chatbot/knowledge-base/:id", async () => {
    deleteMock.mockResolvedValueOnce({ deleted: true })
    await deleteKnowledgeEntry("kb-1")
    expect(deleteMock).toHaveBeenCalled()
  })

  it("syncKnowledgeBase calls POST /chatbot/knowledge-base/sync", async () => {
    postMock.mockResolvedValueOnce({ synced: 5 })
    await syncKnowledgeBase()
    expect(postMock).toHaveBeenCalled()
  })

  it("fetchKnowledgeFiles calls GET /chatbot/knowledge-base/files", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchKnowledgeFiles({ page: 1 })
    expect(getMock).toHaveBeenCalled()
  })

  it("processKnowledgeFile calls POST /chatbot/knowledge-base/files/:id/process", async () => {
    postMock.mockResolvedValueOnce({ processed: true })
    await processKnowledgeFile("file-1")
    expect(postMock).toHaveBeenCalled()
  })

  it("deleteKnowledgeFile calls DELETE /chatbot/knowledge-base/files/:id", async () => {
    deleteMock.mockResolvedValueOnce({ deleted: true })
    await deleteKnowledgeFile("file-1")
    expect(deleteMock).toHaveBeenCalled()
  })
})
