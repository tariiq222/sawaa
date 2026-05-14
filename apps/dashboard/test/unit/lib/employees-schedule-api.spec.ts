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
  fetchAvailability,
  setAvailability,
  fetchBreaks,
  setBreaks,
  fetchSlots,
  fetchVacations,
  createVacation,
  deleteVacation,
  fetchEmployeeServices,
  assignService,
  updateEmployeeService,
  removeEmployeeService,
  fetchEmployeeServiceTypes,
  fetchEmployeeRatings,
} from "@/lib/api/employees-schedule"

describe("employees-schedule api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchAvailability calls /employees/:id/availability", async () => {
    getMock.mockResolvedValueOnce({ schedule: [] })
    await fetchAvailability("p-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/availability")
  })

  it("setAvailability patches to /employees/:id/availability", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await setAvailability("p-1", { schedule: [] } as Parameters<typeof setAvailability>[1])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/availability", { windows: [] })
  })

  it("fetchBreaks calls /employees/:id/breaks", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchBreaks("p-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/breaks")
  })

  it("setBreaks puts to /employees/:id/breaks", async () => {
    putMock.mockResolvedValueOnce([])
    await setBreaks("p-1", { breaks: [] } as Parameters<typeof setBreaks>[1])
    expect(putMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/breaks", expect.anything())
  })

  it("fetchSlots calls /employees/:id/slots with params", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchSlots("p-1", "2026-04-01", 30)
    expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/slots", { date: "2026-04-01", duration: 30 })
  })

  it("fetchVacations calls /employees/:id/vacations", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchVacations("p-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/vacations")
  })

  it("createVacation posts to /employees/:id/vacations", async () => {
    postMock.mockResolvedValueOnce({})
    await createVacation("p-1", { startDate: "2026-05-01", endDate: "2026-05-05" } as Parameters<typeof createVacation>[1])
    expect(postMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/vacations", expect.anything())
  })

  it("deleteVacation calls /employees/:pId/vacations/:vId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteVacation("p-1", "v-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/vacations/v-1")
  })

  it("fetchEmployeeServices calls /employees/:id/services", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchEmployeeServices("p-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/services")
  })

  it("assignService posts to /employees/:id/services", async () => {
    postMock.mockResolvedValueOnce({})
    await assignService("p-1", { serviceId: "svc-1" } as Parameters<typeof assignService>[1])
    expect(postMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/services", expect.anything())
  })

  it("updateEmployeeService patches /employees/:pId/services/:sId", async () => {
    patchMock.mockResolvedValueOnce({})
    await updateEmployeeService("p-1", "svc-1", { price: 100 } as Parameters<typeof updateEmployeeService>[2])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/services/svc-1", expect.anything())
  })

  it("removeEmployeeService deletes /employees/:pId/services/:sId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeEmployeeService("p-1", "svc-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/services/svc-1")
  })

  it("fetchEmployeeServiceTypes calls /employees/:pId/services/:sId/types", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchEmployeeServiceTypes("p-1", "svc-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/services/svc-1/types")
  })

  it("fetchEmployeeRatings calls /employees/:id/ratings", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchEmployeeRatings("p-1", { page: 1 })
    expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/ratings", expect.anything())
  })

  describe("fetchSlots response normalization", () => {
    it("returns array directly when response is an array", async () => {
      const slots = [{ start: "09:00", end: "09:30" }, { start: "10:00", end: "10:30" }]
      getMock.mockResolvedValueOnce(slots)

      const result = await fetchSlots("p-1", "2026-04-01")

      expect(result).toEqual(slots)
    })

    it("extracts slots from object when response is { slots: [...] }", async () => {
      getMock.mockResolvedValueOnce({ slots: [{ start: "09:00", end: "09:30" }] })

      const result = await fetchSlots("p-1", "2026-04-01")

      expect(result).toEqual([{ start: "09:00", end: "09:30" }])
    })

    it("returns empty array when response object has null slots", async () => {
      getMock.mockResolvedValueOnce({ slots: null })

      const result = await fetchSlots("p-1", "2026-04-01")

      expect(result).toEqual([])
    })

    it("returns empty array when response object has undefined slots", async () => {
      getMock.mockResolvedValueOnce({ slots: undefined })

      const result = await fetchSlots("p-1", "2026-04-01")

      expect(result).toEqual([])
    })

    it("passes duration as optional param", async () => {
      getMock.mockResolvedValueOnce([])
      await fetchSlots("p-1", "2026-04-01", 45)
      expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/slots", { date: "2026-04-01", duration: 45 })
    })

    it("works without duration param", async () => {
      getMock.mockResolvedValueOnce([])
      await fetchSlots("p-1", "2026-04-01")
      expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/slots", { date: "2026-04-01", duration: undefined })
    })
  })

  describe("fetchEmployeeRatings edge cases", () => {
    it("normalizes backend score into the rating stars field", async () => {
      getMock.mockResolvedValueOnce({
        items: [
          {
            id: "rating-1",
            bookingId: "booking-1",
            score: 5,
            comment: "ممتاز",
            createdAt: "2026-05-01T00:00:00.000Z",
          },
        ],
        meta: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      })

      const result = await fetchEmployeeRatings("p-1", { page: 1 })

      expect(result.items[0]).toMatchObject({
        id: "rating-1",
        stars: 5,
        comment: "ممتاز",
      })
    })

    it("sends page and perPage params", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: {} })
      await fetchEmployeeRatings("p-1", { page: 3, perPage: 50 })
      expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/ratings", { page: 3, limit: 50 })
    })

    it("defaults to empty query object", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: {} })
      await fetchEmployeeRatings("p-1")
      expect(getMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/ratings", { page: undefined, limit: undefined })
    })
  })

  describe("setAvailability edge cases", () => {
    it("sends full schedule payload", async () => {
      patchMock.mockResolvedValueOnce(undefined)
      const payload = {
        schedule: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true }],
      }
      await setAvailability("p-1", payload as Parameters<typeof setAvailability>[1])
      expect(patchMock).toHaveBeenCalledWith("/dashboard/people/employees/p-1/availability", {
        windows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true }],
      })
    })
  })
})
