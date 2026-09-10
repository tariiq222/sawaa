import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, delete: deleteMock },
}))

import {
  assignEmployeeToBranch,
  fetchBranches,
  unassignEmployeeFromBranch,
} from "@/lib/api/branches"

describe("branches api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBranches calls /branches with filters", async () => {
    getMock.mockResolvedValueOnce({
      items: [
        {
          id: "branch-1",
          nameAr: "الفرع الرئيسي",
          nameEn: null,
          addressAr: "الرياض",
          addressEn: null,
          phone: "+966500000000",
          isMain: true,
          isActive: true,
          timezone: "Asia/Riyadh",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      meta: { total: 1 },
    })

    const response = await fetchBranches({ page: 1, search: "main" })

    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/organization/branches?page=1&search=main",
    )
    expect(response.items[0]).toEqual({
      id: "branch-1",
      nameAr: "الفرع الرئيسي",
      nameEn: "",
      addressAr: "الرياض",
      addressEn: null,
      phone: "+966500000000",
      isMain: true,
      isActive: true,
      timezone: "Asia/Riyadh",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    })
  })

  it("assignEmployeeToBranch posts the generated request and returns the link", async () => {
    const assignment = {
      id: "link-1",
      branchId: "branch-1",
      employeeId: "employee-1",
    }
    postMock.mockResolvedValueOnce(assignment)

    await expect(
      assignEmployeeToBranch("branch-1", "employee-1"),
    ).resolves.toEqual(assignment)
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/organization/branches/branch-1/employees",
      { employeeId: "employee-1" },
    )
  })

  it("unassignEmployeeFromBranch deletes the generated path and returns its id", async () => {
    deleteMock.mockResolvedValueOnce({ id: "link-1" })

    await expect(
      unassignEmployeeFromBranch("branch-1", "employee-1"),
    ).resolves.toEqual({ id: "link-1" })
    expect(deleteMock).toHaveBeenCalledWith(
      "/dashboard/organization/branches/branch-1/employees/employee-1",
    )
  })
})
