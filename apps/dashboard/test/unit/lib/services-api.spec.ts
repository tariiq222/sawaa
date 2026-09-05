import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getMock,
  postMock,
  patchMock,
  deleteMock,
  putMock,
  openApiGetMock,
  openApiPostMock,
  openApiPatchMock,
  openApiPutMock,
  openApiDeleteMock,
  getAccessTokenMock,
} = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
  openApiGetMock: vi.fn(),
  openApiPostMock: vi.fn(),
  openApiPatchMock: vi.fn(),
  openApiPutMock: vi.fn(),
  openApiDeleteMock: vi.fn(),
  getAccessTokenMock: vi.fn(() => "test-token"),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
  getAccessToken: getAccessTokenMock,
}))

vi.mock("@/lib/api/openapi", () => ({
  openApi: {
    get: openApiGetMock,
    post: openApiPostMock,
    put: openApiPutMock,
    patch: openApiPatchMock,
    delete: openApiDeleteMock,
  },
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
  fetchServicesListStats,
} from "@/lib/api/services"
import {
  fetchIntakeForms,
  createIntakeForm,
  deleteIntakeForm,
  updateIntakeForm,
  setIntakeFields,
  fetchIntakeResponses,
} from "@/lib/api/intake-forms"

const intakeFormResponseWire = {
  id: "form-1",
  createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
  nameAr: "نموذج",
  nameEn: "Form",
  type: "PRE_BOOKING",
  scope: "SERVICE",
  scopeId: "svc-1",
  ref: 1024,
  isActive: true,
  submissionsCount: 0,
  fields: [],
}

describe("services api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchCategories calls /dashboard/organization/categories", async () => {
    openApiGetMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchCategories()
    expect(openApiGetMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/categories",
      { query: expect.any(Object) },
    )
  })

  it("createCategory posts to /dashboard/organization/categories", async () => {
    openApiPostMock.mockResolvedValueOnce({ id: "cat-1" })
    await createCategory({ nameEn: "Physio", nameAr: "علاج", departmentId: "dept-1" })
    expect(openApiPostMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/categories",
      { body: expect.objectContaining({ nameEn: "Physio" }) },
    )
  })

  it("updateCategory patches /dashboard/organization/categories/:id", async () => {
    openApiPatchMock.mockResolvedValueOnce({ id: "cat-1" })
    await updateCategory("cat-1", { nameEn: "Physio" })
    expect(openApiPatchMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/categories/{categoryId}",
      { path: { categoryId: "cat-1" }, body: expect.anything() },
    )
  })

  it("deleteCategory calls DELETE /dashboard/organization/categories/:id", async () => {
    openApiDeleteMock.mockResolvedValueOnce({ id: "cat-1" })
    await expect(deleteCategory("cat-1")).resolves.toBeUndefined()
    expect(openApiDeleteMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/categories/{categoryId}",
      { path: { categoryId: "cat-1" } },
    )
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

  it("fetchIntakeForms uses the typed intake-forms path", async () => {
    openApiGetMock.mockResolvedValueOnce([])
    await fetchIntakeForms()
    expect(openApiGetMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/intake-forms",
      { query: undefined },
    )
  })

  it("createIntakeForm posts a typed wire payload", async () => {
    openApiPostMock.mockResolvedValueOnce(intakeFormResponseWire)
    await createIntakeForm({
      nameAr: "نموذج", nameEn: "Form", type: "pre_booking", scope: "service", scopeId: "svc-1",
    })
    expect(openApiPostMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/intake-forms",
      { body: {
        nameAr: "نموذج", nameEn: "Form", type: "PRE_BOOKING", scope: "SERVICE", scopeId: "svc-1",
      } },
    )
  })

  it("updateIntakeForm patches the typed intake-form path", async () => {
    openApiPatchMock.mockResolvedValueOnce(intakeFormResponseWire)
    await updateIntakeForm("form-1", { nameAr: "محدث" })
    expect(openApiPatchMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/intake-forms/{formId}",
      { path: { formId: "form-1" }, body: { nameAr: "محدث" } },
    )
  })

  it("deleteIntakeForm calls DELETE on the typed intake-form path", async () => {
    openApiDeleteMock.mockResolvedValueOnce(undefined)
    await deleteIntakeForm("form-1")
    expect(openApiDeleteMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/intake-forms/{formId}",
      { path: { formId: "form-1" } },
    )
  })

  it("setIntakeFields puts to the typed intake-form fields path", async () => {
    openApiPutMock.mockResolvedValueOnce(intakeFormResponseWire)
    await setIntakeFields("form-1", { fields: [] } as Parameters<typeof setIntakeFields>[1])
    expect(openApiPutMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/intake-forms/{formId}/fields",
      { path: { formId: "form-1" }, body: { fields: [] } },
    )
  })

  it("fetchIntakeResponses uses the typed responses path", async () => {
    openApiGetMock.mockResolvedValueOnce([])
    await fetchIntakeResponses("bk-1")
    expect(openApiGetMock).toHaveBeenCalledWith(
      "/api/v1/dashboard/organization/intake-forms/responses/{bookingId}",
      { path: { bookingId: "bk-1" } },
    )
  })

  describe("fetchServices edge cases", () => {
    it("sends all query params including categoryId, search and includeHidden", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchServices({
        page: 2,
        limit: 50,
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

  describe("fetchServicesListStats", () => {
    it("fetches total and active counts via Promise.all", async () => {
      getMock
        .mockResolvedValueOnce({ meta: { total: 25 } })
        .mockResolvedValueOnce({ meta: { total: 18 } })

      const stats = await fetchServicesListStats()

      expect(stats.total).toBe(25)
      expect(stats.active).toBe(18)
      expect(stats.inactive).toBe(7)
    })

    it("handles missing meta gracefully", async () => {
      getMock.mockResolvedValueOnce({}).mockResolvedValueOnce({})

      const stats = await fetchServicesListStats()

      expect(stats.total).toBe(0)
      expect(stats.active).toBe(0)
      expect(stats.inactive).toBe(0)
    })
  })
})
