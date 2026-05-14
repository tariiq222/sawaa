import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
}))

import {
  fetchOrganizationHours,
  updateOrganizationHours,
  fetchOrganizationHolidays,
  createOrganizationHoliday,
  deleteOrganizationHoliday,
} from "@/lib/api/organization"

import {
  fetchBookingSettings,
  updateBookingSettings,
} from "@/lib/api/booking-settings"

describe("organization api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchOrganizationHours calls branch-scoped hours endpoint", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchOrganizationHours("branch-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/hours/branch-1")
  })

  it("updateOrganizationHours posts backend schedule shape", async () => {
    postMock.mockResolvedValueOnce([])
    await updateOrganizationHours("branch-1", [
      { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true },
    ])
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/hours", {
      branchId: "branch-1",
      schedule: [
        { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isOpen: true },
      ],
    })
  })

  it("fetchOrganizationHolidays passes required branchId", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchOrganizationHolidays("branch-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/holidays", { branchId: "branch-1" })
  })

  it("fetchOrganizationHolidays passes branchId and year params", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchOrganizationHolidays("branch-1", 2026)
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/holidays", { branchId: "branch-1", year: 2026 })
  })

  it("createOrganizationHoliday includes branchId", async () => {
    postMock.mockResolvedValueOnce({})
    await createOrganizationHoliday("branch-1", { date: "2026-12-25", nameAr: "عيد", nameEn: "Holiday" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/holidays", {
      branchId: "branch-1",
      date: "2026-12-25",
      nameAr: "عيد",
      nameEn: "Holiday",
    })
  })

  it("deleteOrganizationHoliday deletes /organization/holidays/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteOrganizationHoliday("h-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/organization/holidays/h-1")
  })
})

describe("booking-settings api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchBookingSettings calls /booking-settings", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchBookingSettings()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/booking-settings")
  })

  it("updateBookingSettings patches /booking-settings", async () => {
    patchMock.mockResolvedValueOnce({})
    await updateBookingSettings({ bufferMinutes: 10 })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/booking-settings", { bufferMinutes: 10 })
  })
})
