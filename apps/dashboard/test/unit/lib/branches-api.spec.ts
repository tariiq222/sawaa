import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock },
}))

import {
  fetchBranches,
  fetchBranch,
  createBranch,
  updateBranch,
} from "@/lib/api/branches"

describe("branches api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBranches calls /branches with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchBranches({ page: 1, search: "main" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/branches", expect.objectContaining({ search: "main" }))
  })

  it("fetchBranch calls /branches/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "br-1" })
    await fetchBranch("br-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/branches/br-1")
  })

  it("createBranch posts to /branches", async () => {
    postMock.mockResolvedValueOnce({ id: "br-1" })
    await createBranch({ nameAr: "الرئيسي" } as Parameters<typeof createBranch>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/branches", expect.objectContaining({ nameAr: "الرئيسي" }))
  })

  it("updateBranch patches /branches/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "br-1" })
    await updateBranch("br-1", { nameAr: "updated" } as Parameters<typeof updateBranch>[1])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/branches/br-1", expect.anything())
  })

})
