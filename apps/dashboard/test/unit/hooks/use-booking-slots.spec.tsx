import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchSlots, fetchEmployeeServiceTypes, fetchEmployeeServices } = vi.hoisted(() => ({
  fetchSlots: vi.fn(),
  fetchEmployeeServiceTypes: vi.fn(),
  fetchEmployeeServices: vi.fn(),
}))

vi.mock("@/lib/api/employees-schedule", () => ({
  fetchSlots,
  fetchEmployeeServiceTypes,
  fetchEmployeeServices,
}))

import { useCreateBookingSlots } from "@/components/features/bookings/use-booking-slots"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

const baseOpts = {
  employeeId: "p-1",
  serviceId: "svc-1",
  deliveryType: "in_person",
  date: "2026-03-27",
}

const mockEmployeeServices = [
  {
    id: "ps1",
    serviceId: "svc-1",
    customDuration: null,
    bufferMinutes: 0,
    availableTypes: ["in_person"],
    isActive: true,
    service: { id: "svc-1", nameAr: "استشارة عامة", nameEn: "General", price: 200, duration: 30 },
  },
]

describe("useCreateBookingSlots", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches employee services when employeeId is provided", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.employeeServicesLoading).toBe(false))

    expect(fetchEmployeeServices).toHaveBeenCalledWith("p-1")
    expect(result.current.employeeServices).toEqual(mockEmployeeServices)
  })

  it("does not fetch employee services when employeeId is empty", () => {
    renderHook(
      () => useCreateBookingSlots({ ...baseOpts, employeeId: "" }),
      { wrapper: makeWrapper() },
    )

    expect(fetchEmployeeServices).not.toHaveBeenCalled()
  })

  it("fetches service types when employeeId and serviceId are provided", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(fetchEmployeeServiceTypes).toHaveBeenCalledWith("p-1", "svc-1")
    expect(result.current.canFetchServiceTypes).toBe(true)
  })

  it("does not fetch service types when employeeId is missing", () => {
    renderHook(
      () => useCreateBookingSlots({ ...baseOpts, employeeId: "" }),
      { wrapper: makeWrapper() },
    )

    expect(fetchEmployeeServiceTypes).not.toHaveBeenCalled()
  })

  it("does not fetch service types when serviceId is missing", () => {
    renderHook(
      () => useCreateBookingSlots({ ...baseOpts, serviceId: "" }),
      { wrapper: makeWrapper() },
    )

    expect(fetchEmployeeServiceTypes).not.toHaveBeenCalled()
  })

  it("fetches slots with fallback service duration when no service types returned", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([{ startTime: "09:00", endTime: "09:30" }])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    expect(fetchSlots).toHaveBeenCalledWith("p-1", "2026-03-27", 30, { serviceId: "svc-1", deliveryType: "in_person" })
    expect(result.current.selectedDuration).toBe(30)
    expect(result.current.slots).toHaveLength(1)
  })

  it("uses service type duration when service type exists for deliveryType", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([
      { deliveryType: "in_person", isActive: true, duration: 45, durationOptions: [] },
    ])
    fetchSlots.mockResolvedValue([{ startTime: "09:00", endTime: "09:45" }])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    expect(fetchSlots).toHaveBeenCalledWith("p-1", "2026-03-27", 45, { serviceId: "svc-1", deliveryType: "in_person" })
    expect(result.current.selectedDuration).toBe(45)
    expect(result.current.slots).toHaveLength(1)
  })

  it("returns undefined selectedDuration when no duration available", async () => {
    fetchEmployeeServices.mockResolvedValue([])
    fetchEmployeeServiceTypes.mockResolvedValue([
      { deliveryType: "in_person", isActive: true, duration: null, durationOptions: [] },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    expect(result.current.selectedDuration).toBeUndefined()
    expect(result.current.slots).toEqual([])
  })

  it("does not fetch slots when date is missing", () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])

    renderHook(
      () => useCreateBookingSlots({ ...baseOpts, date: "" }),
      { wrapper: makeWrapper() },
    )

    expect(fetchSlots).not.toHaveBeenCalled()
  })

  it("does not fetch slots when selectedDuration is undefined and no fallback", async () => {
    fetchEmployeeServices.mockResolvedValue([])
    fetchEmployeeServiceTypes.mockResolvedValue([
      { deliveryType: "in_person", isActive: true, duration: null },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.canFetchSlots).toBe(false)
    expect(fetchSlots).not.toHaveBeenCalled()
  })

  it("handles fetchEmployeeServiceTypes error gracefully — returns undefined duration from fallback", async () => {
    fetchEmployeeServices.mockResolvedValue([])
    fetchEmployeeServiceTypes.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }))

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, serviceId: "unassigned-svc" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.selectedDuration).toBeUndefined()
    expect(result.current.canFetchSlots).toBe(false)
  })

  it("uses act to verify state stabilizes", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    act(() => { /* state stabilized */ })

    expect(result.current.slots).toEqual([])
  })

  it("slots are empty while slotsLoading is true", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])
    fetchSlots.mockImplementation(
      () =>
        new Promise((r) =>
          setTimeout(() => r([{ startTime: "09:00", endTime: "09:30" }]), 200),
        ),
    )

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    expect(result.current.slotsLoading).toBe(true)
    expect(result.current.slots).toEqual([])

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))
  })

  it("gracefully returns empty slots when fetchSlots throws", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])
    fetchSlots.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))
    expect(result.current.slots).toEqual([])
  })
})
