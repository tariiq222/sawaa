import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  api: { put: vi.fn() },
}))

import { api } from "@/lib/api"
import { updateEmployeeSchedule } from "@/lib/api/employees-schedule"

describe("updateEmployeeSchedule", () => {
  it("PUTs to the schedule endpoint with the schedule payload", async () => {
    vi.mocked(api.put).mockResolvedValue({ schedule: [] })
    const schedule = [
      { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true },
    ]
    await updateEmployeeSchedule("emp-1", schedule)
    expect(api.put).toHaveBeenCalledWith(
      "/dashboard/employees/emp-1/availability/schedule",
      { schedule },
    )
  })

  it("returns the response body", async () => {
    const schedule = [{ dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isActive: true }]
    vi.mocked(api.put).mockResolvedValue({ schedule })
    const out = await updateEmployeeSchedule("emp-1", schedule)
    expect(out.schedule).toEqual(schedule)
  })
})
