import { describe, expect, it } from "vitest"
import {
  slotSchema,
  scheduleSchema,
  nextKey,
  DAY_NAMES,
} from "@/components/features/employees/schedule-editor.types"

describe("slotSchema", () => {
  it("accepts a valid slot", () => {
    const ok = slotSchema.safeParse({ dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true })
    expect(ok.success).toBe(true)
  })

  it("rejects dayOfWeek out of range", () => {
    expect(slotSchema.safeParse({ dayOfWeek: 7, startTime: "09:00", endTime: "17:00", isActive: true }).success).toBe(false)
    expect(slotSchema.safeParse({ dayOfWeek: -1, startTime: "09:00", endTime: "17:00", isActive: true }).success).toBe(false)
  })

  it("rejects non-HH:mm time strings", () => {
    expect(slotSchema.safeParse({ dayOfWeek: 0, startTime: "9:00", endTime: "17:00", isActive: true }).success).toBe(false)
    expect(slotSchema.safeParse({ dayOfWeek: 0, startTime: "09:00", endTime: "25:00", isActive: false }).success).toBe(true) // 25:00 passes the regex (doc of current behavior)
    expect(slotSchema.safeParse({ dayOfWeek: 0, startTime: "09-00", endTime: "17:00", isActive: true }).success).toBe(false)
  })
})

describe("scheduleSchema", () => {
  const buildSchedule = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      dayOfWeek: i % 7,
      startTime: "09:00",
      endTime: "17:00",
      isActive: true,
    }))

  it("requires exactly 7 slots", () => {
    expect(scheduleSchema.safeParse({ schedule: buildSchedule(7) }).success).toBe(true)
    expect(scheduleSchema.safeParse({ schedule: buildSchedule(6) }).success).toBe(false)
    expect(scheduleSchema.safeParse({ schedule: buildSchedule(8) }).success).toBe(false)
  })
})

describe("DAY_NAMES", () => {
  it("is a 7-tuple of weekday names starting at Sunday", () => {
    expect(DAY_NAMES).toHaveLength(7)
    expect(DAY_NAMES[0]).toBe("Sunday")
    expect(DAY_NAMES[6]).toBe("Saturday")
  })
})

describe("nextKey", () => {
  it("returns a unique break key each call", () => {
    const a = nextKey()
    const b = nextKey()
    expect(a).toMatch(/^break-\d+$/)
    expect(b).toMatch(/^break-\d+$/)
    expect(a).not.toBe(b)
  })
})
