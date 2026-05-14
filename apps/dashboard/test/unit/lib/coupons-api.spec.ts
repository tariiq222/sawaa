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
  fetchCoupons,
  fetchCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/api/coupons"

describe("coupons api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchCoupons calls /coupons with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchCoupons({ page: 1, status: "active" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/coupons", expect.objectContaining({ status: "active" }))
  })

  it("fetchCoupon calls /coupons/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "cp-1" })
    await fetchCoupon("cp-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/coupons/cp-1")
  })

  it("createCoupon posts to /coupons", async () => {
    postMock.mockResolvedValueOnce({ id: "cp-1" })
    await createCoupon({ code: "SAVE10" } as Parameters<typeof createCoupon>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/finance/coupons", expect.objectContaining({ code: "SAVE10" }))
  })

  it("updateCoupon patches /coupons/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "cp-1" })
    await updateCoupon("cp-1", { code: "SAVE20" } as Parameters<typeof updateCoupon>[1])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/finance/coupons/cp-1", expect.anything())
  })

  it("deleteCoupon deletes /coupons/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteCoupon("cp-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/finance/coupons/cp-1")
  })
})
