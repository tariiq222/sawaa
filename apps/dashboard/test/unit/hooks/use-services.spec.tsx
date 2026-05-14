import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const servicesApi = vi.hoisted(() => ({
  fetchServices: vi.fn(),
  fetchServicesListStats: vi.fn(),
  fetchCategories: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  fetchDurationOptions: vi.fn(),
  setDurationOptions: vi.fn(),
  fetchServiceBookingTypes: vi.fn(),
  setServiceBookingTypes: vi.fn(),
  fetchServiceEmployees: vi.fn(),
}))

const intakeFormsApi = vi.hoisted(() => ({
  fetchIntakeForms: vi.fn(),
  createIntakeForm: vi.fn(),
  updateIntakeForm: vi.fn(),
  deleteIntakeForm: vi.fn(),
  setIntakeFields: vi.fn(),
}))

const employeesApi = vi.hoisted(() => ({
  assignService: vi.fn(),
}))

vi.mock("@/lib/api/services", () => servicesApi)
vi.mock("@/lib/api/intake-forms", () => intakeFormsApi)
vi.mock("@/lib/api/employees", () => employeesApi)

import {
  useServices,
  useServicesListStats,
  useCategories,
  useCategoriesList,
  useServiceMutations,
  useCategoryMutations,
  useDurationOptions,
  useDurationOptionsMutation,
  useServiceBookingTypes,
  useServiceBookingTypesMutation,
  useIntakeForms,
  useIntakeFormMutations,
  useServiceEmployees,
  useAssignEmployeesToService,
} from "@/hooks/use-services"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

function resetAll() {
  Object.values(servicesApi).forEach((m) => m.mockReset())
  Object.values(intakeFormsApi).forEach((m) => m.mockReset())
  Object.values(employeesApi).forEach((m) => m.mockReset())
}

describe("useServices (list)", () => {
  beforeEach(resetAll)

  it("fetches with default page/perPage and includeHidden:true", async () => {
    servicesApi.fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useServices(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(servicesApi.fetchServices).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20, includeHidden: true }),
    )
  })

  it("setCategoryId resets page to 1 and drives the API filter", async () => {
    servicesApi.fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useServices(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setPage(4) })
    act(() => { result.current.setCategoryId("cat-1") })
    await waitFor(() =>
      expect(servicesApi.fetchServices).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, categoryId: "cat-1" }),
      ),
    )
  })

  it("setIsActive resets page to 1", async () => {
    servicesApi.fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useServices(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setPage(3) })
    act(() => { result.current.setIsActive(false) })
    await waitFor(() =>
      expect(servicesApi.fetchServices).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, isActive: false }),
      ),
    )
  })

  it("resetFilters clears everything", async () => {
    servicesApi.fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useServices(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setSearch("foo"); result.current.setCategoryId("c"); result.current.setIsActive(true) })
    act(() => { result.current.resetFilters() })
    expect(result.current.search).toBe("")
    expect(result.current.categoryId).toBeUndefined()
    expect(result.current.isActive).toBeUndefined()
    expect(result.current.page).toBe(1)
  })

  it("surfaces error.message from the query", async () => {
    servicesApi.fetchServices.mockRejectedValueOnce(new Error("boom"))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useServices(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.error).toBe("boom"))
  })
})

describe("useServicesListStats / useCategories", () => {
  beforeEach(resetAll)

  it("useServicesListStats wraps the stats API", async () => {
    servicesApi.fetchServicesListStats.mockResolvedValue({ total: 3 })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useServicesListStats(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual({ total: 3 })
  })

  it("useCategories fetches with a large perPage and unwraps items", async () => {
    servicesApi.fetchCategories.mockResolvedValue({ items: [{ id: "c-1" }], meta: { total: 1 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useCategories(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(servicesApi.fetchCategories).toHaveBeenCalledWith({ page: 1, perPage: 200 })
    expect(result.current.data).toEqual([{ id: "c-1" }])
  })
})

describe("useCategoriesList", () => {
  beforeEach(resetAll)

  it("setIsActive resets page to 1", async () => {
    servicesApi.fetchCategories.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useCategoriesList(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setPage(5) })
    act(() => { result.current.setIsActive(true) })
    await waitFor(() =>
      expect(servicesApi.fetchCategories).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, isActive: true }),
      ),
    )
  })

  it("surfaces non-Error failures as null (typeof err !== Error)", async () => {
    servicesApi.fetchCategories.mockRejectedValueOnce("string-error")
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useCategoriesList(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeNull()
  })
})

describe("useServiceMutations / useCategoryMutations", () => {
  beforeEach(resetAll)

  it("service createMut calls createService + invalidates services cache", async () => {
    servicesApi.createService.mockResolvedValue({ id: "s-1" })
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useServiceMutations(), { wrapper: Wrapper })
    await result.current.createMut.mutateAsync({ nameAr: "قلب", durationMins: 30, price: 0 })
    expect(servicesApi.createService).toHaveBeenCalledWith({ nameAr: "قلب", durationMins: 30, price: 0 }, expect.anything())
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["services"] }))
  })

  it("service updateMut splits id from payload", async () => {
    servicesApi.updateService.mockResolvedValue({ id: "s-1" })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useServiceMutations(), { wrapper: Wrapper })
    await result.current.updateMut.mutateAsync({ id: "s-1", nameAr: "جديد" } as { id: string; nameAr: string })
    expect(servicesApi.updateService).toHaveBeenCalledWith("s-1", { nameAr: "جديد" })
  })

  it("category mutations invalidate services/categories cache", async () => {
    servicesApi.createCategory.mockResolvedValue({ id: "c-1" })
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: Wrapper })
    await result.current.createMut.mutateAsync({ nameAr: "قلب" })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["services", "categories"] })
  })
})

describe("useDurationOptions(+mutation) / useServiceBookingTypes(+mutation)", () => {
  beforeEach(resetAll)

  it("useDurationOptions skips fetch when serviceId is null", () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useDurationOptions(null), { wrapper: Wrapper })
    expect(servicesApi.fetchDurationOptions).not.toHaveBeenCalled()
  })

  it("duration mutation passes serviceId + payload and invalidates both caches", async () => {
    servicesApi.setDurationOptions.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useDurationOptionsMutation(), { wrapper: Wrapper })
    await result.current.mutateAsync({ serviceId: "s-1", payload: { durations: [30] } as never })
    expect(servicesApi.setDurationOptions).toHaveBeenCalledWith("s-1", { durations: [30] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["services", "duration-options", "s-1"] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["services"] })
  })

  it("useServiceBookingTypes skips fetch when serviceId is null", () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useServiceBookingTypes(null), { wrapper: Wrapper })
    expect(servicesApi.fetchServiceBookingTypes).not.toHaveBeenCalled()
  })

  it("booking-types mutation invalidates only the specific service's booking-types key", async () => {
    servicesApi.setServiceBookingTypes.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useServiceBookingTypesMutation("s-1"), { wrapper: Wrapper })
    await result.current.mutateAsync({ types: ["in_person"] } as never)
    expect(servicesApi.setServiceBookingTypes).toHaveBeenCalledWith("s-1", { types: ["in_person"] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["services", "s-1", "booking-types"] })
  })
})

describe("useIntakeForms / useIntakeFormMutations", () => {
  beforeEach(resetAll)

  it("skips fetching when serviceId is null", () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useIntakeForms(null), { wrapper: Wrapper })
    expect(intakeFormsApi.fetchIntakeForms).not.toHaveBeenCalled()
  })

  it("createMut maps the public payload to the backend-shape call", async () => {
    intakeFormsApi.createIntakeForm.mockResolvedValue({ id: "f-1" })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useIntakeFormMutations("s-1"), { wrapper: Wrapper })
    await result.current.createMut.mutateAsync({ nameAr: "نموذج", isActive: true })
    expect(intakeFormsApi.createIntakeForm).toHaveBeenCalledWith({
      nameAr: "نموذج",
      nameEn: "نموذج",
      type: "pre_booking",
      scope: "service",
      isActive: true,
    })
  })

  it("createMut prefers explicit nameEn when provided", async () => {
    intakeFormsApi.createIntakeForm.mockResolvedValue({ id: "f-1" })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useIntakeFormMutations("s-1"), { wrapper: Wrapper })
    await result.current.createMut.mutateAsync({ nameAr: "نموذج", nameEn: "Form", isActive: true })
    expect(intakeFormsApi.createIntakeForm).toHaveBeenCalledWith(expect.objectContaining({ nameEn: "Form" }))
  })

  it("setFieldsMut splits formId from payload", async () => {
    intakeFormsApi.setIntakeFields.mockResolvedValue(undefined)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useIntakeFormMutations("s-1"), { wrapper: Wrapper })
    await result.current.setFieldsMut.mutateAsync({
      formId: "f-1",
      payload: { fields: [] } as never,
    })
    expect(intakeFormsApi.setIntakeFields).toHaveBeenCalledWith("f-1", { fields: [] })
  })

  it("all intake-form mutations invalidate the service's intake-forms cache", async () => {
    intakeFormsApi.createIntakeForm.mockResolvedValue({ id: "f-1" })
    intakeFormsApi.deleteIntakeForm.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useIntakeFormMutations("s-1"), { wrapper: Wrapper })
    await result.current.createMut.mutateAsync({ nameAr: "x", isActive: true })
    await result.current.deleteMut.mutateAsync("f-1")
    for (const call of spy.mock.calls) {
      expect((call[0]?.queryKey as unknown[])?.[0]).toBe("services")
    }
  })
})

describe("useServiceEmployees / useAssignEmployeesToService", () => {
  beforeEach(resetAll)

  it("useServiceEmployees skips fetching when serviceId is empty", () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useServiceEmployees(""), { wrapper: Wrapper })
    expect(servicesApi.fetchServiceEmployees).not.toHaveBeenCalled()
  })

  it("useAssignEmployeesToService calls assignService for every id in parallel", async () => {
    employeesApi.assignService.mockResolvedValue(undefined)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useAssignEmployeesToService("s-1"), { wrapper: Wrapper })
    await result.current.mutateAsync(["e-1", "e-2", "e-3"])
    expect(employeesApi.assignService).toHaveBeenCalledTimes(3)
    expect(employeesApi.assignService).toHaveBeenCalledWith("e-1", {
      serviceId: "s-1",
      availableTypes: ["in_person", "online"],
      isActive: true,
    })
  })

  it("useAssignEmployeesToService invalidates the service's employees cache on success", async () => {
    employeesApi.assignService.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useAssignEmployeesToService("s-1"), { wrapper: Wrapper })
    await result.current.mutateAsync(["e-1"])
    expect(spy).toHaveBeenCalledWith({ queryKey: ["services", "employees", "s-1"] })
  })
})
