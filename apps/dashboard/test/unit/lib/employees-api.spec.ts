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
        meta: { total: 0, page: 1, perPage: 20 },
      })

      await fetchEmployees({
        page: 2,
        perPage: 15,
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

    it("maps backend rating field to averageRating", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", rating: 4.5, reviewCount: 12 }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].averageRating).toBe(4.5)
      expect(result.items[0]._count!.ratings).toBe(12)
    })

    it("prefers averageRating over rating when both present", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", averageRating: 3.8, rating: 4.5, reviewCount: 5 }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].averageRating).toBe(3.8)
    })

    it("defaults _count.bookings to 0 when not returned by backend", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", rating: 4.0, reviewCount: 3 }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0]!._count!.bookings).toBe(0)
    })

    it("passes through existing _count from backend", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", _count: { bookings: 10, ratings: 6 } }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0]._count).toEqual({ bookings: 10, ratings: 6 })
    })
  })

  describe("fetchEmployee", () => {
    it("calls /dashboard/people/employees/:id", async () => {
      getMock.mockResolvedValueOnce({ id: "p-1", rating: 4.2, reviewCount: 8 })

      await fetchEmployee("p-1")

      expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1")
    })

    it("maps backend shape before returning", async () => {
      getMock.mockResolvedValueOnce({ id: "p-1", rating: 4.2, reviewCount: 8 })

      const result = await fetchEmployee("p-1")

      expect(result.averageRating).toBe(4.2)
      expect(result._count!.ratings).toBe(8)
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

  describe("mapEmployee edge cases", () => {
    it("preserves specialty as-is when it is already a string", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: "Orthopedics" }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].specialty).toBe("Orthopedics")
    })

    it("sets specialty to empty string when null", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: null }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].specialty).toBe("")
    })

    it("uses specialtyAr from raw when specialty is string", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: "Orthopedics", specialtyAr: "عظام" }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].specialtyAr).toBe("عظام")
    })

    it("sets specialtyAr to null when specialty is null", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: null }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].specialtyAr).toBeNull()
    })

    it("sets specialtyAr to null when specialty is string and specialtyAr is missing", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: "General" }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].specialtyAr).toBeNull()
    })

    it("extracts avatarUrl from user object", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", user: { avatarUrl: "https://img.url/pic.jpg" } }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].avatarUrl).toBe("https://img.url/pic.jpg")
    })

    it("falls back to raw avatarUrl when user.avatarUrl is null", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", user: { avatarUrl: null }, avatarUrl: "fallback.jpg" }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].avatarUrl).toBe("fallback.jpg")
    })

    it("sets avatarUrl to null when both user.avatarUrl and raw.avatarUrl are missing", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", user: {} }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].avatarUrl).toBeNull()
    })

    it("sets averageRating to undefined when neither averageRating nor rating exist", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", _count: { bookings: 0, ratings: 0 } }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0].averageRating).toBeUndefined()
    })

    it("defaults _count to {bookings:0, ratings:0} when _count and reviewCount both missing", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1" }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0]._count).toEqual({ bookings: 0, ratings: 0 })
    })

    it("uses reviewCount as ratings count in default _count", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", reviewCount: 7 }],
        meta: { total: 1 },
      })

      const result = await fetchEmployees()

      expect(result.items[0]!._count!.ratings).toBe(7)
      expect(result.items[0]!._count!.bookings).toBe(0)
    })
  })
})
