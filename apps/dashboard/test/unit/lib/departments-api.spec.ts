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
  fetchDepartments,
  createDepartment,
  updateDepartment,
} from "@/lib/api/departments"

describe("departments api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchDepartments calls /departments with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchDepartments({ page: 1, search: "cardio" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/departments", expect.objectContaining({ search: "cardio" }))
  })

  it("createDepartment posts to /departments", async () => {
    postMock.mockResolvedValueOnce({ id: "d-1", nameAr: "جلدية" })
    await createDepartment({ nameAr: "جلدية" } as Parameters<typeof createDepartment>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/departments", expect.objectContaining({ nameAr: "جلدية" }))
  })

  it("updateDepartment patches /departments/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "d-1", nameAr: "updated" })
    await updateDepartment("d-1", { nameAr: "updated" } as Parameters<typeof updateDepartment>[1])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/departments/d-1", expect.anything())
  })
})
