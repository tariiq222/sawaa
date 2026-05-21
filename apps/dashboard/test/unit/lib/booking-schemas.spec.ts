import { describe, expect, it } from "vitest"
import {
  bookingCreateSchema,
  rescheduleBookingSchema,
  walkInClientSchema,
} from "@/lib/schemas/booking.schema"

describe("bookingCreateSchema", () => {
  const valid = {
    employeeId: "p-1",
    serviceId: "svc-1",
    type: "in_person" as const,
    date: "2026-04-10",
    startTime: "10:00",
  }

  it("accepts a valid booking payload", () => {
    const result = bookingCreateSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("accepts all booking types", () => {
    const types = [
      "in_person",
      "online",
      "walk_in",
    ] as const

    for (const type of types) {
      const result = bookingCreateSchema.safeParse({ ...valid, type })
      expect(result.success, `type "${type}" should be valid`).toBe(true)
    }
  })

  it("rejects unknown booking type", () => {
    const result = bookingCreateSchema.safeParse({ ...valid, type: "home_visit" })
    expect(result.success).toBe(false)
  })

  it("rejects missing employeeId", () => {
    const rest = (({ employeeId: _p, ...r }) => r)(valid)
    const result = bookingCreateSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects empty employeeId", () => {
    const result = bookingCreateSchema.safeParse({ ...valid, employeeId: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing serviceId", () => {
    const rest = (({ serviceId: _s, ...r }) => r)(valid)
    const result = bookingCreateSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects empty serviceId", () => {
    const result = bookingCreateSchema.safeParse({ ...valid, serviceId: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing date", () => {
    const { date: _d, ...rest } = valid; void _d
    const result = bookingCreateSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects empty date string", () => {
    const result = bookingCreateSchema.safeParse({ ...valid, date: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing startTime", () => {
    const { startTime: _s, ...rest } = valid; void _s
    const result = bookingCreateSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects empty startTime string", () => {
    const result = bookingCreateSchema.safeParse({ ...valid, startTime: "" })
    expect(result.success).toBe(false)
  })

  it("accepts optional durationOptionId", () => {
    const result = bookingCreateSchema.safeParse({
      ...valid,
      durationOptionId: "dur-30",
    })
    expect(result.success).toBe(true)
  })

  it("accepts optional payAtClinic flag", () => {
    const result = bookingCreateSchema.safeParse({ ...valid, payAtClinic: true })
    expect(result.success).toBe(true)
  })

  it("accepts payAtClinic false", () => {
    const result = bookingCreateSchema.safeParse({ ...valid, payAtClinic: false })
    expect(result.success).toBe(true)
  })
})

describe("rescheduleBookingSchema", () => {
  it("accepts valid date and time", () => {
    const result = rescheduleBookingSchema.safeParse({
      date: "2026-04-15",
      startTime: "14:30",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing date", () => {
    const result = rescheduleBookingSchema.safeParse({ startTime: "09:00" })
    expect(result.success).toBe(false)
  })

  it("rejects empty date string", () => {
    const result = rescheduleBookingSchema.safeParse({ date: "", startTime: "09:00" })
    expect(result.success).toBe(false)
  })

  it("rejects missing startTime", () => {
    const result = rescheduleBookingSchema.safeParse({ date: "2026-04-15" })
    expect(result.success).toBe(false)
  })

  it("rejects empty startTime string", () => {
    const result = rescheduleBookingSchema.safeParse({ date: "2026-04-15", startTime: "" })
    expect(result.success).toBe(false)
  })
})

describe("walkInClientSchema", () => {
  const valid = {
    fullName: "Mohammed Al-Ahmad",
    phone: "+966501234567",
  }

  it("accepts a valid walk-in payload", () => {
    const result = walkInClientSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("rejects missing fullName", () => {
    const { fullName: _f, ...rest } = valid; void _f
    const result = walkInClientSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects empty fullName", () => {
    const result = walkInClientSchema.safeParse({ ...valid, fullName: "" })
    expect(result.success).toBe(false)
  })

  it("rejects whitespace-only fullName", () => {
    const result = walkInClientSchema.safeParse({ ...valid, fullName: "   " })
    expect(result.success).toBe(false)
  })

  it("trims fullName before validation", () => {
    const result = walkInClientSchema.safeParse({ ...valid, fullName: "  Mohammed Al-Ahmad  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fullName).toBe("Mohammed Al-Ahmad")
    }
  })

  it("rejects missing phone", () => {
    const { phone: _p, ...rest } = valid; void _p
    const result = walkInClientSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects invalid phone format", () => {
    const result = walkInClientSchema.safeParse({ ...valid, phone: "0501234567" })
    expect(result.success).toBe(false)
  })
})
