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
  fetchEmployees,
  fetchEmployee,
  createEmployee,
  onboardEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/api/employees"

describe("employees api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchEmployees", () => {
    it("sends all query params to /dashboard/people/employees", async () => {
      getMock.mockResolvedValueOnce({
        items: [],
        meta: { total: 0, page: 1, limit: 20 },
      })

      await fetchEmployees({
        page: 2,
        limit: 15,
        search: "سارة",
        isActive: true,
        minRating: 4,
        sortBy: "name",
        sortOrder: "asc",
      })

      expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees", {
        page: 2,
        limit: 15,
        search: "سارة",
        isActive: true,
        minRating: 4,
        sortBy: "name",
        sortOrder: "asc",
      })
    })

    it("defaults to empty query object", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchEmployees()
      expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees", expect.any(Object))
    })

  })

  describe("fetchEmployee", () => {
    it("calls /dashboard/people/employees/:id and returns the detail projection", async () => {
      getMock.mockResolvedValueOnce({
        id: "p-1",
        ref: 7,
        userId: null,
        name: "Ali Hassan",
        nameAr: null,
        nameEn: "Ali Hassan",
        title: null,
        specialty: "Family Therapy",
        specialtyAr: null,
        gender: null,
        bio: null,
        bioAr: null,
        education: null,
        educationAr: null,
        experience: null,
        phone: null,
        email: null,
        avatarUrl: null,
        employmentType: "FULL_TIME",
        onboardingStatus: "COMPLETED",
        isActive: true,
        isAcceptingBookings: true,
        isPublic: false,
        slug: null,
        publicBioAr: null,
        publicBioEn: null,
        publicImageUrl: null,
        averageRating: null,
        ratingCount: 0,
        bookingCount: 0,
        branchIds: [],
        serviceIds: [],
        availability: [],
        exceptions: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const result = await fetchEmployee("p-1")

      expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1")
      expect(result.user.firstName).toBe("Ali")
      expect(result.exceptions).toEqual([])
    })
  })

  describe("createEmployee", () => {
    it("posts to /dashboard/people/employees with payload", async () => {
      postMock.mockResolvedValueOnce({ id: "p-2" })

      await createEmployee({
        userId: "u-1",
        specialty: "General",
        firstName: "فاطمة",
        lastName: "الزهراني",
        email: "fatima@clinic.com",
      } as Parameters<typeof createEmployee>[0])

      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/people/employees",
        expect.objectContaining({ firstName: "فاطمة" }),
      )
    })
  })

  describe("onboardEmployee", () => {
    it("posts to /dashboard/people/employees/onboarding", async () => {
      postMock.mockResolvedValueOnce({ employeeId: "p-3", inviteUrl: "https://..." })

      await onboardEmployee({
        email: "new@clinic.com",
      } as Parameters<typeof onboardEmployee>[0])

      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/people/employees/onboarding",
        expect.objectContaining({ email: "new@clinic.com" }),
      )
    })
  })

  describe("updateEmployee", () => {
    it("patches /dashboard/people/employees/:id with payload", async () => {
      patchMock.mockResolvedValueOnce({ id: "p-1" })

      await updateEmployee("p-1", { bio: "متخصص في أمراض القلب" })

      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/people/employees/p-1",
        { bio: "متخصص في أمراض القلب" },
      )
    })
  })

  describe("deleteEmployee", () => {
    it("calls DELETE /dashboard/people/employees/:id", async () => {
      deleteMock.mockResolvedValueOnce(undefined)

      await deleteEmployee("p-1")

      expect(deleteMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1")
    })
  })

  describe("mapEmployee projection", () => {
    const wireRow = {
      id: "p-1",
      ref: 7,
      userId: "u-1",
      name: "Ali Hassan",
      nameAr: "علي حسن",
      nameEn: "Ali Hassan",
      title: null,
      specialty: "Family Therapy",
      specialtyAr: "علاج أسري",
      gender: "MALE",
      bio: null,
      bioAr: null,
      education: null,
      educationAr: null,
      experience: 4,
      phone: "+966500000000",
      email: "ali@example.com",
      avatarUrl: null,
      employmentType: "FULL_TIME",
      onboardingStatus: "COMPLETED",
      isActive: true,
      isAcceptingBookings: true,
      isPublic: false,
      slug: null,
      publicBioAr: null,
      publicBioEn: null,
      publicImageUrl: null,
      averageRating: 4.2,
      ratingCount: 8,
      bookingCount: 12,
      branchIds: ["br-1"],
      serviceIds: ["svc-1"],
      availability: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }

    it("splits the display name into the synthetic user projection", async () => {
      getMock.mockResolvedValueOnce({ items: [wireRow], meta: { total: 1 } })

      const result = await fetchEmployees()

      expect(result.items[0].user).toEqual({
        id: "u-1",
        firstName: "علي",
        lastName: "حسن",
        email: "ali@example.com",
        phone: "+966500000000",
      })
    })

    it("keeps the wire counters unchanged", async () => {
      getMock.mockResolvedValueOnce({ items: [wireRow], meta: { total: 1 } })

      const result = await fetchEmployees()

      expect(result.items[0].averageRating).toBe(4.2)
      expect(result.items[0].ratingCount).toBe(8)
      expect(result.items[0].bookingCount).toBe(12)
    })

    it("normalises a null specialty to an empty string", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ ...wireRow, specialty: null }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].specialty).toBe("")
    })

    it("falls back to the English name when the Arabic name is absent", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ ...wireRow, nameAr: null }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].user.firstName).toBe("Ali")
    })
  })
})
