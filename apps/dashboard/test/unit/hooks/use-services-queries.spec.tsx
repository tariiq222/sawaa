import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchServices,
  fetchCategories,
  fetchDurationOptions,
  fetchServiceBookingTypes,
  fetchIntakeForms,
  createService,
  updateService,
  deleteService,
  createCategory,
  updateCategory,
  deleteCategory,
  setDurationOptions,
  setServiceBookingTypes,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
} = vi.hoisted(() => ({
  fetchServices: vi.fn(),
  fetchCategories: vi.fn(),
  fetchDurationOptions: vi.fn(),
  fetchServiceBookingTypes: vi.fn(),
  fetchIntakeForms: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  setDurationOptions: vi.fn(),
  setServiceBookingTypes: vi.fn(),
  createIntakeForm: vi.fn(),
  updateIntakeForm: vi.fn(),
  deleteIntakeForm: vi.fn(),
  setIntakeFields: vi.fn(),
}))

vi.mock("@/lib/api/services", () => ({
  fetchServices,
  fetchCategories,
  fetchDurationOptions,
  fetchServiceBookingTypes,
  createService,
  updateService,
  deleteService,
  createCategory,
  updateCategory,
  deleteCategory,
  setDurationOptions,
  setServiceBookingTypes,
}))

vi.mock("@/lib/api/intake-forms", () => ({
  fetchIntakeForms,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
}))

import {
  useServices,
  useCategories,
  useDurationOptions,
  useServiceBookingTypes,
  useIntakeForms,
} from "@/hooks/use-services"

// useCategories now fetches paginated data internally and returns items
// useIntakeForms now calls fetchIntakeFormsApi() without args

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useServices", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches services and returns items", async () => {
    const items = [{ id: "svc-1", name: "Haircut" }]
    fetchServices.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchServices).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20, includeHidden: true }),
    )
    expect(result.current.services).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns empty array before data arrives", () => {
    fetchServices.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.services).toEqual([])
  })

  it("setSearch resets page to 1", async () => {
    fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("massage") })

    await waitFor(() =>
      expect(fetchServices).toHaveBeenCalledWith(
        expect.objectContaining({ search: "massage", page: 1 }),
      ),
    )
  })

  it("resetFilters clears search and categoryId", async () => {
    fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setSearch("test")
      result.current.setCategoryId("cat-1")
    })

    act(() => { result.current.resetFilters() })

    await waitFor(() => {
      expect(result.current.search).toBe("")
      expect(result.current.categoryId).toBeUndefined()
      expect(result.current.page).toBe(1)
    })
  })

  it("setCategoryId resets page to 1", async () => {
    fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setCategoryId("cat-1") })

    await waitFor(() =>
      expect(fetchServices).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: "cat-1", page: 1 }),
      ),
    )
  })

  it("setIsActive resets page to 1", async () => {
    fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setIsActive(true) })

    await waitFor(() =>
      expect(fetchServices).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, page: 1 }),
      ),
    )
  })

  it("resetFilters clears all filters", async () => {
    fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setSearch("test")
      result.current.setCategoryId("cat-1")
      result.current.setIsActive(true)
    })

    act(() => { result.current.resetFilters() })

    await waitFor(() => {
      expect(result.current.search).toBe("")
      expect(result.current.categoryId).toBeUndefined()
      expect(result.current.isActive).toBeUndefined()
      expect(result.current.page).toBe(1)
    })
  })

  it("returns error message when fetch fails", async () => {
    fetchServices.mockRejectedValueOnce(new Error("Server error"))

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBe("Server error")
  })

  it("returns null meta and empty services when no data", () => {
    fetchServices.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })

    expect(result.current.meta).toBeNull()
    expect(result.current.services).toEqual([])
  })

  it("always sends includeHidden: true in query", async () => {
    fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchServices).toHaveBeenCalledWith(
      expect.objectContaining({ includeHidden: true }),
    )
  })

  it("passes undefined search when search is empty", async () => {
    fetchServices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchServices).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    )
  })
})

describe("useCategories", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches categories", async () => {
    const cats = [{ id: "cat-1", name: "Wellness" }]
    fetchCategories.mockResolvedValueOnce({ items: cats, meta: { total: 1 } })

    const { result } = renderHook(() => useCategories(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchCategories).toHaveBeenCalledWith({ page: 1, perPage: 200 })
    expect(result.current.data).toEqual(cats)
  })
})

describe("useDurationOptions", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches duration options when serviceId provided", async () => {
    const opts = [{ id: "d-1", durationMinutes: 30 }]
    fetchDurationOptions.mockResolvedValueOnce(opts)

    const { result } = renderHook(() => useDurationOptions("svc-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchDurationOptions).toHaveBeenCalledWith("svc-1")
    expect(result.current.data).toEqual(opts)
  })

  it("does not fetch when serviceId is null", () => {
    renderHook(() => useDurationOptions(null), { wrapper: makeWrapper() })

    expect(fetchDurationOptions).not.toHaveBeenCalled()
  })
})

describe("useServiceBookingTypes", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches booking types when serviceId provided", async () => {
    const types = [{ id: "bt-1", bookingType: "IN_PERSON" }]
    fetchServiceBookingTypes.mockResolvedValueOnce(types)

    const { result } = renderHook(
      () => useServiceBookingTypes("svc-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchServiceBookingTypes).toHaveBeenCalledWith("svc-1")
    expect(result.current.data).toEqual(types)
  })

  it("does not fetch when serviceId is null", () => {
    renderHook(() => useServiceBookingTypes(null), { wrapper: makeWrapper() })

    expect(fetchServiceBookingTypes).not.toHaveBeenCalled()
  })
})

describe("useIntakeForms", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches intake forms when serviceId provided", async () => {
    const forms = [{ id: "form-1", title: "Health Check" }]
    fetchIntakeForms.mockResolvedValueOnce(forms)

    const { result } = renderHook(
      () => useIntakeForms("svc-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchIntakeForms).toHaveBeenCalled()
    expect(result.current.data).toEqual(forms)
  })

  it("does not fetch when serviceId is null", () => {
    renderHook(() => useIntakeForms(null), { wrapper: makeWrapper() })

    expect(fetchIntakeForms).not.toHaveBeenCalled()
  })
})
