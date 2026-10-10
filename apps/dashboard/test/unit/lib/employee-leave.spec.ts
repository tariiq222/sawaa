import { describe, expect, it } from "vitest"
import { isLeaveCurrentOrUpcoming } from "@/lib/employee-leave"
describe("employee leave visibility", () => {
  it("retains leave during its final Riyadh day, then hides it after midnight", () => {
    const end = "2026-10-10T00:00:00.000Z"
    expect(isLeaveCurrentOrUpcoming(end, new Date("2026-10-10T20:59:59.999Z"))).toBe(true)
    expect(isLeaveCurrentOrUpcoming(end, new Date("2026-10-10T21:00:00.000Z"))).toBe(false)
  })
  it("rejects invalid dates", () => expect(isLeaveCurrentOrUpcoming("invalid")).toBe(false))
})
