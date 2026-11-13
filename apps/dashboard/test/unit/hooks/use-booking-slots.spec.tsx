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

// Mirrors the GET .../services wire row. Note the embedded service exposes
// `durationMins`, which the hook deliberately does not use as a fallback.
const mockEmployeeServices = [
  {
    id: "ps1",
    employeeId: "p-1",
    serviceId: "svc-1",
    bufferMinutes: 0,
    isActive: true,
    disabledDeliveryTypes: [],
    useCustomPricing: false,
    service: { id: "svc-1", nameAr: "استشارة عامة", nameEn: "General", price: "200", durationMins: 30 },
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

  it("does not fall back to the assignment row's base duration when no service type duration exists", async () => {
    // The embedded service row carries `durationMins`; the historical fallback
    // read `service.duration` and therefore always produced undefined. This
    // pins that no fallback is enabled: the hook must not start fetching slots
    // in a case where it previously did not.
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.selectedDuration).toBeUndefined()
    expect(result.current.canFetchSlots).toBe(false)
    expect(fetchSlots).not.toHaveBeenCalled()
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

    await waitFor(() => expect(fetchSlots).toHaveBeenCalled())

    expect(fetchSlots).toHaveBeenCalledWith("p-1", "2026-03-27", 45, { serviceId: "svc-1", deliveryType: "in_person" })
    expect(result.current.selectedDuration).toBe(45)
    await waitFor(() => expect(result.current.slots).toHaveLength(1))
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
    fetchEmployeeServiceTypes.mockResolvedValue([
      { deliveryType: "in_person", isActive: true, duration: 30, durationOptions: [] },
    ])
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
    // An explicit service-type duration is the only path that starts the fetch.
    fetchEmployeeServiceTypes.mockResolvedValue([
      { deliveryType: "in_person", isActive: true, duration: 30, durationOptions: [] },
    ])
    fetchSlots.mockImplementation(
      () =>
        new Promise((r) =>
          setTimeout(() => r([{ startTime: "09:00", endTime: "09:30" }]), 200),
        ),
    )

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    // slotsLoading only flips true once the upstream duration resolves and
    // the (still-pending) slots fetch is in flight.
    await waitFor(() => expect(result.current.slotsLoading).toBe(true))
    expect(result.current.slots).toEqual([])

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))
  })

  it("gracefully returns empty slots when fetchSlots throws", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([
      { deliveryType: "in_person", isActive: true, duration: 30, durationOptions: [] },
    ])
    fetchSlots.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))
    expect(result.current.slots).toEqual([])
  })
})
