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
  fetchPackages,
  fetchPackage,
  createPackage,
  updatePackage,
  deletePackage,
} from "@/lib/api/packages"

describe("packages api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchPackages maps perPage → limit and forwards the new isPublic filter", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchPackages({
      page: 3,
      perPage: 20,
      search: "استشارة",
      isActive: true,
      isPublic: true,
    })
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/packages", {
      page: 3,
      limit: 20,
      search: "استشارة",
      isActive: true,
      isPublic: true,
    })
  })

  it("fetchPackage GETs the detail endpoint", async () => {
    getMock.mockResolvedValueOnce({ id: "pkg-1" })
    await fetchPackage("pkg-1")
    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/organization/packages/pkg-1",
    )
  })

  it("createPackage POSTs the payload unchanged (items array included)", async () => {
    postMock.mockResolvedValueOnce({ id: "pkg-new" })
    const payload = {
      nameAr: "باقة",
      discountType: "FIXED",
      discountValue: 5000,
      isPublic: true,
      items: [
        {
          serviceId: "s-1",
          employeeId: "e-1",
          durationOptionId: "d-1",
          paidQuantity: 2,
          freeQuantity: 0,
        },
      ],
    } as Parameters<typeof createPackage>[0]
    await createPackage(payload)
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/organization/packages",
      payload,
    )
  })

  it("updatePackage PATCHes the detail endpoint with the partial payload", async () => {
    patchMock.mockResolvedValueOnce({ id: "pkg-1" })
    await updatePackage("pkg-1", { isActive: false, isPublic: true })
    expect(patchMock).toHaveBeenCalledWith(
      "/dashboard/organization/packages/pkg-1",
      { isActive: false, isPublic: true },
    )
  })

  it("deletePackage DELETEs the detail endpoint", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deletePackage("pkg-1")
    expect(deleteMock).toHaveBeenCalledWith(
      "/dashboard/organization/packages/pkg-1",
    )
  })
})
