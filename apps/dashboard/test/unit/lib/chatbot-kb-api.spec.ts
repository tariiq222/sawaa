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

import {
  fetchKnowledgeBase,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
} from "@/lib/api/chatbot-kb"

describe("chatbot-kb api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchKnowledgeBase calls GET /dashboard/ai/knowledge-base", async () => {
    getMock.mockResolvedValueOnce({ data: [], meta: { total: 0 } })
    await fetchKnowledgeBase({ page: 1 })
    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/ai/knowledge-base",
      expect.objectContaining({ page: 1 }),
    )
  })

  it("updateKnowledgeEntry calls PATCH /dashboard/ai/knowledge-base/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "kb-1" })
    await updateKnowledgeEntry("kb-1", { title: "Updated" })
    expect(patchMock).toHaveBeenCalledWith(
      "/dashboard/ai/knowledge-base/kb-1",
      expect.objectContaining({ title: "Updated" }),
    )
  })

  it("deleteKnowledgeEntry calls DELETE /dashboard/ai/knowledge-base/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteKnowledgeEntry("kb-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/ai/knowledge-base/kb-1")
  })
})
