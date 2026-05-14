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
  bookingType: "in_person",
  date: "2026-03-27",
  durationOptionId: "",
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

  it("fetches slots when employeeId and date are provided with no duration options", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([{ startTime: "09:00", endTime: "09:30" }])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    expect(fetchSlots).toHaveBeenCalledWith("p-1", "2026-03-27", undefined)
    expect(result.current.slots).toHaveLength(1)
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

  it("returns duration options from matching active service type", async () => {
    const durationOptions = [{ id: "d-1", durationMinutes: 30, label: "30m", labelAr: "٣٠", price: null, isDefault: true, sortOrder: 0 }]
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([
      { bookingType: "in_person", isActive: true, durationOptions },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, durationOptionId: "d-1" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.durationOptions).toEqual(durationOptions)
    expect(result.current.hasDurationOptions).toBe(true)
    expect(result.current.selectedDuration).toBe(30)
  })

  it("returns empty duration options for inactive service type", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([
      { bookingType: "in_person", isActive: false, durationOptions: [{ id: "d-1", durationMinutes: 30 }] },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.hasDurationOptions).toBe(false)
    expect(result.current.durationOptions).toHaveLength(0)
  })

  it("returns empty duration options when bookingType has no matching service type", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([
      { bookingType: "in_person", isActive: true, durationOptions: [] },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, bookingType: "online" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.hasDurationOptions).toBe(false)
  })

  it("blocks slot fetching when duration options exist but none selected", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([
      {
        bookingType: "in_person",
        isActive: true,
        durationOptions: [{ id: "d-1", durationMinutes: 30 }],
      },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, durationOptionId: "" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.hasDurationOptions).toBe(true)
    expect(result.current.canFetchSlots).toBe(false)
  })

  it("fetches slots with correct duration when option is selected", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockResolvedValue([
      { bookingType: "in_person", isActive: true, durationOptions: [{ id: "d-1", durationMinutes: 45 }] },
    ])
    fetchSlots.mockResolvedValue([{ startTime: "09:00", endTime: "09:45" }])

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, durationOptionId: "d-1" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    expect(fetchSlots).toHaveBeenCalledWith("p-1", "2026-03-27", 45)
    expect(result.current.canFetchSlots).toBe(true)
  })

  it("handles fetchEmployeeServiceTypes error gracefully — returns empty types", async () => {
    fetchEmployeeServices.mockResolvedValue(mockEmployeeServices)
    fetchEmployeeServiceTypes.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }))

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, serviceId: "unassigned-svc" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.durationOptions).toEqual([])
    expect(result.current.hasDurationOptions).toBe(false)
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
})
