import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchOrganizationHours,
  updateOrganizationHours,
  fetchOrganizationHolidays,
  createOrganizationHoliday,
  deleteOrganizationHoliday,
} = vi.hoisted(() => ({
  fetchOrganizationHours: vi.fn(),
  updateOrganizationHours: vi.fn(),
  fetchOrganizationHolidays: vi.fn(),
  createOrganizationHoliday: vi.fn(),
  deleteOrganizationHoliday: vi.fn(),
}))

const { fetchBookingSettings, updateBookingSettings } = vi.hoisted(() => ({
  fetchBookingSettings: vi.fn(),
  updateBookingSettings: vi.fn(),
}))

vi.mock("@/lib/api/organization", () => ({
  fetchOrganizationHours,
  updateOrganizationHours,
  fetchOrganizationHolidays,
  createOrganizationHoliday,
  deleteOrganizationHoliday,
}))

vi.mock("@/lib/api/booking-settings", () => ({
  fetchBookingSettings,
  updateBookingSettings,
}))

import {
  useOrganizationHours,
  useOrganizationHoursMutation,
  useOrganizationHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useBookingSettings,
  useBookingSettingsMutation,
} from "@/hooks/use-organization-settings"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useOrganizationHours", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches organization hours", async () => {
    const hours = [{ day: "MONDAY", isOpen: true }]
    fetchOrganizationHours.mockResolvedValueOnce(hours)

    const { result } = renderHook(() => useOrganizationHours("branch-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchOrganizationHours).toHaveBeenCalledWith("branch-1")
    expect(result.current.data).toEqual(hours)
  })
})

describe("useOrganizationHoursMutation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls updateOrganizationHours with payload", async () => {
    updateOrganizationHours.mockResolvedValueOnce([])

    const { result } = renderHook(() => useOrganizationHoursMutation(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ branchId: "branch-1", hours: [] })
    })

    await waitFor(() => expect(updateOrganizationHours).toHaveBeenCalledWith("branch-1", []))
  })
})

describe("useOrganizationHolidays", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches organization holidays", async () => {
    const holidays = [{ id: "h-1", name: "National Day", date: "2026-09-23" }]
    fetchOrganizationHolidays.mockResolvedValueOnce(holidays)

    const { result } = renderHook(() => useOrganizationHolidays("branch-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchOrganizationHolidays).toHaveBeenCalledWith("branch-1", undefined)
    expect(result.current.data).toEqual(holidays)
  })
})

describe("useCreateHoliday", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls createOrganizationHoliday with data", async () => {
    createOrganizationHoliday.mockResolvedValueOnce({ id: "h-2" })

    const { result } = renderHook(() => useCreateHoliday(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ branchId: "branch-1", nameAr: "عيد", nameEn: "Eid", date: "2026-03-30" })
    })

    await waitFor(() =>
      expect(createOrganizationHoliday).toHaveBeenCalledWith(
        "branch-1",
        expect.objectContaining({ nameAr: "عيد" }),
      ),
    )
  })
})

describe("useDeleteHoliday", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls deleteOrganizationHoliday with id", async () => {
    deleteOrganizationHoliday.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useDeleteHoliday(), { wrapper: makeWrapper() })

    act(() => { result.current.mutate("h-1") })

    await waitFor(() => expect(deleteOrganizationHoliday).toHaveBeenCalled())
    expect(deleteOrganizationHoliday.mock.calls[0][0]).toBe("h-1")
  })
})

describe("useBookingSettings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches booking settings", async () => {
    const settings = { bufferMinutes: 10, maxAdvanceBookingDays: 30 }
    fetchBookingSettings.mockResolvedValueOnce(settings)

    const { result } = renderHook(() => useBookingSettings(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchBookingSettings).toHaveBeenCalled()
    expect(result.current.data).toEqual(settings)
  })
})

describe("useBookingSettingsMutation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls updateBookingSettings with payload", async () => {
    updateBookingSettings.mockResolvedValueOnce({ waitlistEnabled: false })

    const { result } = renderHook(() => useBookingSettingsMutation(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ waitlistEnabled: false } as Parameters<typeof updateBookingSettings>[0])
    })

    await waitFor(() => expect(updateBookingSettings).toHaveBeenCalled())
    expect(updateBookingSettings.mock.calls[0][0]).toEqual(
      expect.objectContaining({ waitlistEnabled: false }),
    )
  })
})
