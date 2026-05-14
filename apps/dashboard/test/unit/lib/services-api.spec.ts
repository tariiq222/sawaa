import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock, getAccessTokenMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
  getAccessTokenMock: vi.fn(() => "test-token"),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
  getAccessToken: getAccessTokenMock,
}))

import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchServices,
  fetchService,
  createService,
  updateService,
  deleteService,
  fetchDurationOptions,
  setDurationOptions,
  fetchServiceBookingTypes,
  setServiceBookingTypes,
  fetchServiceEmployees,
} from "@/lib/api/services"
import {
  fetchIntakeForms,
  createIntakeForm,
  deleteIntakeForm,
  updateIntakeForm,
  setIntakeFields,
  fetchIntakeResponses,
} from "@/lib/api/intake-forms"

describe("services api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchCategories calls /dashboard/organization/categories", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchCategories()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/categories", expect.anything())
  })

  it("createCategory posts to /dashboard/organization/categories", async () => {
    postMock.mockResolvedValueOnce({ id: "cat-1" })
    await createCategory({ nameEn: "Physio", nameAr: "علاج", departmentId: "dept-1" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/categories", expect.objectContaining({ nameEn: "Physio" }))
  })

  it("updateCategory patches /dashboard/organization/categories/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "cat-1" })
    await updateCategory("cat-1", { nameEn: "Physio" })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/categories/cat-1", expect.anything())
  })

  it("deleteCategory calls DELETE /dashboard/organization/categories/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteCategory("cat-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/organization/categories/cat-1")
  })

  it("fetchServices sends query params to /dashboard/organization/services", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchServices({ isActive: true })
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/services", expect.objectContaining({ isActive: true }))
  })

  it("fetchService calls /dashboard/organization/services/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "svc-1" })
    await fetchService("svc-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/services/svc-1")
  })

  it("createService posts to /dashboard/organization/services", async () => {
    postMock.mockResolvedValueOnce({ id: "svc-1" })
    await createService({ nameEn: "Service" } as Parameters<typeof createService>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/services", expect.anything())
  })

  it("updateService patches /dashboard/organization/services/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "svc-1" })
    await updateService("svc-1", { nameEn: "Updated" })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/services/svc-1", expect.anything())
  })

  it("deleteService calls DELETE /dashboard/organization/services/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteService("svc-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/organization/services/svc-1")
  })

  it("fetchDurationOptions calls /dashboard/organization/services/:id/duration-options", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchDurationOptions("svc-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/services/svc-1/duration-options")
  })

  it("setDurationOptions puts to /dashboard/organization/services/:id/duration-options", async () => {
    putMock.mockResolvedValueOnce([])
    await setDurationOptions("svc-1", { options: [] } as Parameters<typeof setDurationOptions>[1])
    expect(putMock).toHaveBeenCalledWith("/dashboard/organization/services/svc-1/duration-options", expect.anything())
  })

  it("fetchServiceBookingTypes calls /dashboard/organization/services/:id/booking-types", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchServiceBookingTypes("svc-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/services/svc-1/booking-types")
  })

  it("setServiceBookingTypes puts to /dashboard/organization/services/:id/booking-types", async () => {
    putMock.mockResolvedValueOnce([])
    await setServiceBookingTypes("svc-1", { types: [] } as Parameters<typeof setServiceBookingTypes>[1])
    expect(putMock).toHaveBeenCalledWith("/dashboard/organization/services/svc-1/booking-types", expect.anything())
  })

  it("fetchIntakeForms calls /dashboard/organization/intake-forms", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeForms()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms", undefined)
  })

  it("createIntakeForm posts to /dashboard/organization/intake-forms", async () => {
    postMock.mockResolvedValueOnce({ id: "form-1" })
    await createIntakeForm({ nameAr: "نموذج", nameEn: "Form", type: "pre_booking", scope: "service" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms", expect.anything())
  })

  it("updateIntakeForm patches /dashboard/organization/intake-forms/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "form-1" })
    await updateIntakeForm("form-1", { nameAr: "محدث" })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1", expect.anything())
  })

  it("deleteIntakeForm calls DELETE /dashboard/organization/intake-forms/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteIntakeForm("form-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1")
  })

  it("setIntakeFields puts to /dashboard/organization/intake-forms/:id/fields", async () => {
    putMock.mockResolvedValueOnce({})
    await setIntakeFields("form-1", { fields: [] } as Parameters<typeof setIntakeFields>[1])
    expect(putMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1/fields", expect.anything())
  })

  it("fetchIntakeResponses calls /dashboard/organization/intake-forms/responses/:bookingId", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeResponses("bk-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/responses/bk-1")
  })

  describe("fetchServices edge cases", () => {
    it("sends all query params including categoryId, search and includeHidden", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchServices({
        page: 2,
        perPage: 50,
        categoryId: "cat-1",
        isActive: false,
        includeHidden: false,
        search: "massage",
      })
      expect(getMock).toHaveBeenCalledWith("/dashboard/organization/services", expect.objectContaining({
        page: 2,
        limit: 50,
        categoryId: "cat-1",
        isActive: false,
        includeHidden: false,
        search: "massage",
      }))
    })

    it("defaults to empty query object", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchServices()
      expect(getMock).toHaveBeenCalledWith("/dashboard/organization/services", expect.any(Object))
    })
  })

  describe("fetchServiceEmployees", () => {
    it("calls /dashboard/organization/services/:id/employees", async () => {
      getMock.mockResolvedValueOnce([{ id: "p-1", name: "Dr. Ali" }])
      await fetchServiceEmployees("svc-1")
      expect(getMock).toHaveBeenCalledWith("/dashboard/organization/services/svc-1/employees")
    })
  })
})
