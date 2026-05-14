import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchOrganizationSettings,
} = vi.hoisted(() => ({
  fetchOrganizationSettings: vi.fn(),
}))

vi.mock("@/lib/api/organization-settings", () => ({
  fetchOrganizationSettings,
}))

vi.mock("@/lib/utils", () => ({
  formatClinicDate: vi.fn((date: string | Date) => "2026-01-01"),
  formatClinicTime: vi.fn((time: string) => "14:00"),
  getWeekStartDay: vi.fn((day: string) => day === "monday" ? 1 : 0),
}))

import { useOrganizationConfig } from "@/hooks/use-organization-config"

describe("useOrganizationConfig", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns default values when no settings", async () => {
    fetchOrganizationSettings.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useOrganizationConfig(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.dateFormat).toBe("Y-m-d")
      expect(result.current.timeFormat).toBe("24h")
      expect(result.current.timezone).toBe("Asia/Riyadh")
    })
  })

  it("returns settings values when loaded", async () => {
    fetchOrganizationSettings.mockResolvedValueOnce({
      dateFormat: "d/m/Y",
      timeFormat: "12h",
      weekStartDay: "monday",
      timezone: "America/New_York",
    })

    const { result } = renderHook(() => useOrganizationConfig(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.dateFormat).toBe("d/m/Y")
      expect(result.current.timeFormat).toBe("12h")
      expect(result.current.weekStartDay).toBe("monday")
      expect(result.current.timezone).toBe("America/New_York")
      expect(result.current.weekStartDayNumber).toBe(1)
    })
  })

  it("provides formatDate and formatTime helpers", async () => {
    fetchOrganizationSettings.mockResolvedValueOnce({
      dateFormat: "Y-m-d",
      timeFormat: "24h",
    })

    const { result } = renderHook(() => useOrganizationConfig(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.formatDate).toBeInstanceOf(Function)
      expect(result.current.formatTime).toBeInstanceOf(Function)
    })
  })
})
