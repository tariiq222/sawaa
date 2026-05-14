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
  useServiceMutations,
  useCategoryMutations,
  useDurationOptionsMutation,
  useServiceBookingTypesMutation,
  useIntakeFormMutations,
} from "@/hooks/use-services"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useServiceMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createService", async () => {
    createService.mockResolvedValueOnce({ id: "svc-new" })

    const { result } = renderHook(() => useServiceMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ name: "New Service" } as Parameters<typeof createService>[0])
    })

    await waitFor(() => expect(createService).toHaveBeenCalled())
  })

  it("updateMut calls updateService with id and payload", async () => {
    updateService.mockResolvedValueOnce({ id: "svc-1" })

    const { result } = renderHook(() => useServiceMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "svc-1", name: "Updated" } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() =>
      expect(updateService).toHaveBeenCalledWith(
        "svc-1",
        expect.objectContaining({ name: "Updated" }),
      ),
    )
  })

  it("deleteMut calls deleteService with id", async () => {
    deleteService.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useServiceMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteMut.mutate("svc-1") })

    await waitFor(() =>
      expect(deleteService).toHaveBeenCalledWith("svc-1", expect.anything()),
    )
  })
})

describe("useCategoryMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createCategory", async () => {
    createCategory.mockResolvedValueOnce({ id: "cat-new" })

    const { result } = renderHook(() => useCategoryMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ name: "Wellness" } as Parameters<typeof createCategory>[0])
    })

    await waitFor(() => expect(createCategory).toHaveBeenCalled())
  })

  it("updateMut calls updateCategory with id and payload", async () => {
    updateCategory.mockResolvedValueOnce({ id: "cat-1" })

    const { result } = renderHook(() => useCategoryMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "cat-1", name: "Updated" } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() =>
      expect(updateCategory).toHaveBeenCalledWith(
        "cat-1",
        expect.objectContaining({ name: "Updated" }),
      ),
    )
  })

  it("deleteMut calls deleteCategory with id", async () => {
    deleteCategory.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useCategoryMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteMut.mutate("cat-1") })

    await waitFor(() =>
      expect(deleteCategory).toHaveBeenCalledWith("cat-1", expect.anything()),
    )
  })
})

describe("useDurationOptionsMutation", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls setDurationOptions with serviceId and payload", async () => {
    setDurationOptions.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDurationOptionsMutation(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({
        serviceId: "svc-1",
        payload: { options: [] } as Parameters<typeof setDurationOptions>[1],
      })
    })

    await waitFor(() =>
      expect(setDurationOptions).toHaveBeenCalledWith(
        "svc-1",
        expect.objectContaining({ options: [] }),
      ),
    )
  })
})

describe("useServiceBookingTypesMutation", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls setServiceBookingTypes with serviceId and payload", async () => {
    setServiceBookingTypes.mockResolvedValueOnce([])

    const { result } = renderHook(
      () => useServiceBookingTypesMutation("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.mutate({ bookingTypes: [] } as Parameters<typeof setServiceBookingTypes>[1])
    })

    await waitFor(() =>
      expect(setServiceBookingTypes).toHaveBeenCalledWith(
        "svc-1",
        expect.objectContaining({ bookingTypes: [] }),
      ),
    )
  })
})

describe("useIntakeFormMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createIntakeForm with mapped payload", async () => {
    createIntakeForm.mockResolvedValueOnce({ id: "form-new" })

    const { result } = renderHook(
      () => useIntakeFormMutations("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.createMut.mutate({ nameAr: "فحص صحي", nameEn: "Health Check", isActive: true } as Parameters<typeof result.current.createMut.mutate>[0])
    })

    await waitFor(() =>
      expect(createIntakeForm).toHaveBeenCalledWith(
        expect.objectContaining({ nameAr: "فحص صحي", nameEn: "Health Check", type: "pre_booking", scope: "service", isActive: true }),
      ),
    )
  })

  it("updateMut calls updateIntakeForm with formId and payload", async () => {
    updateIntakeForm.mockResolvedValueOnce({ id: "form-1" })

    const { result } = renderHook(
      () => useIntakeFormMutations("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.updateMut.mutate({
        formId: "form-1",
        payload: { title: "Updated" } as Parameters<typeof updateIntakeForm>[1],
      })
    })

    await waitFor(() =>
      expect(updateIntakeForm).toHaveBeenCalledWith(
        "form-1",
        expect.objectContaining({ title: "Updated" }),
      ),
    )
  })

  it("deleteMut calls deleteIntakeForm with formId", async () => {
    deleteIntakeForm.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => useIntakeFormMutations("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => { result.current.deleteMut.mutate("form-1") })

    await waitFor(() =>
      expect(deleteIntakeForm).toHaveBeenCalledWith("form-1", expect.anything()),
    )
  })

  it("setFieldsMut calls setIntakeFields with formId and payload", async () => {
    setIntakeFields.mockResolvedValueOnce([])

    const { result } = renderHook(
      () => useIntakeFormMutations("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.setFieldsMut.mutate({
        formId: "form-1",
        payload: { fields: [] } as Parameters<typeof setIntakeFields>[1],
      })
    })

    await waitFor(() =>
      expect(setIntakeFields).toHaveBeenCalledWith(
        "form-1",
        expect.objectContaining({ fields: [] }),
      ),
    )
  })
})
