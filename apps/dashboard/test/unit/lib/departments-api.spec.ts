import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api/openapi", () => ({
  openApi: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    delete: deleteMock,
  },
}))

import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/api/departments"

describe("departments api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchDepartments calls /departments with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchDepartments({ page: 1, search: "cardio" })
    expect(getMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/departments",
      { query: expect.objectContaining({ page: 1, search: "cardio" }) },
    )
  })

  it("createDepartment posts to /departments", async () => {
    postMock.mockResolvedValueOnce({ id: "d-1", nameAr: "جلدية" })
    await createDepartment({ nameAr: "جلدية", nameEn: "Dermatology" })
    expect(postMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/departments",
      { body: expect.objectContaining({ nameAr: "جلدية", nameEn: "Dermatology" }) },
    )
  })

  it("updateDepartment patches /departments/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "d-1", nameAr: "updated" })
    await updateDepartment("d-1", { nameAr: "updated" })
    expect(patchMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/departments/{departmentId}",
      { path: { departmentId: "d-1" }, body: { nameAr: "updated" } },
    )
  })

  it("deleteDepartment deletes /departments/:id", async () => {
    deleteMock.mockResolvedValueOnce({ deleted: true })

    await expect(deleteDepartment("d-1")).resolves.toEqual({ deleted: true })
    expect(deleteMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/departments/{departmentId}",
      { path: { departmentId: "d-1" } },
    )
  })
})
