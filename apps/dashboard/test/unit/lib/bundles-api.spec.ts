import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock },
}))

import {
  fetchBundles,
  fetchBundle,
  createBundle,
  updateBundle,
  deleteBundle,
} from "@/lib/api/bundles"

describe("bundles api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBundles maps perPage to the backend's limit param", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchBundles({ page: 3, perPage: 20, search: "زواج", isActive: true, includeHidden: true })
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/bundles", {
      page: 3,
      limit: 20,
      search: "زواج",
      isActive: true,
      includeHidden: true,
    })
  })

  it("fetchBundle GETs the detail endpoint", async () => {
    getMock.mockResolvedValueOnce({ id: "bun-1" })
    await fetchBundle("bun-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/bundles/bun-1")
  })

  it("createBundle POSTs the payload unchanged", async () => {
    postMock.mockResolvedValueOnce({ id: "bun-new" })
    const payload = {
      nameAr: "باقة",
      discountType: "FIXED",
      discountValue: 5000,
      serviceIds: ["s-1", "s-2"],
    } as Parameters<typeof createBundle>[0]
    await createBundle(payload)
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/bundles", payload)
  })

  it("updateBundle PATCHes the detail endpoint", async () => {
    patchMock.mockResolvedValueOnce({ id: "bun-1" })
    await updateBundle("bun-1", { isActive: false })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/bundles/bun-1", { isActive: false })
  })

  it("deleteBundle DELETEs the detail endpoint", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteBundle("bun-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/organization/bundles/bun-1")
  })
})
