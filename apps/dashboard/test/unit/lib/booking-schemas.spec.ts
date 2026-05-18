import { describe, expect, it } from "vitest"
import {
  bookingCreateSchema,
  rescheduleBookingSchema,
  walkInClientSchema,
  createWalkInClientSchema,
} from "@/lib/schemas/booking.schema"
import { BLOOD_TYPES } from "@/lib/schemas/client.schema"

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
    firstName: "نورة",
    lastName: "العتيبي",
    phone: "+966501234567",
    emergencyName: "أحمد",
    emergencyPhone: "+966551234567",
    bloodType: "A_POS",
    allergies: "لا يوجد",
    chronicConditions: "لا يوجد",
    gender: "female" as const,
  }

  it("accepts a valid walk-in client payload", () => {
    const result = walkInClientSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("accepts minimal payload with only required fields", () => {
    const result = walkInClientSchema.safeParse({
      firstName: "سارة",
      lastName: "القحطاني",
      phone: "+966501234567",
    })
    expect(result.success).toBe(true)
  })

  it("accepts all gender values", () => {
    for (const gender of ["male", "female"] as const) {
      const result = walkInClientSchema.safeParse({ ...valid, gender })
      expect(result.success, `gender "${gender}" should be valid`).toBe(true)
    }
  })

  it("rejects unknown gender value", () => {
    const result = walkInClientSchema.safeParse({ ...valid, gender: "other" })
    expect(result.success).toBe(false)
  })

  it("rejects missing firstName", () => {
    const { firstName: _, ...rest } = valid; void _
    const result = walkInClientSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects empty firstName", () => {
    const result = walkInClientSchema.safeParse({ ...valid, firstName: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing lastName", () => {
    const { lastName: _, ...rest } = valid; void _
    const result = walkInClientSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects empty lastName", () => {
    const result = walkInClientSchema.safeParse({ ...valid, lastName: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing phone", () => {
    const { phone: _, ...rest } = valid; void _
    const result = walkInClientSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects empty phone", () => {
    const result = walkInClientSchema.safeParse({ ...valid, phone: "" })
    expect(result.success).toBe(false)
  })

  it("rejects phone not matching international format", () => {
    for (const phone of ["0501234567", "+9665", "abc"]) {
      const result = walkInClientSchema.safeParse({ ...valid, phone })
      expect(result.success, `phone "${phone}" should be invalid`).toBe(false)
    }
  })

  it("accepts valid international phone variants", () => {
    const phones = ["+966501234567", "+12025551234", "+441234567890"]
    for (const phone of phones) {
      const result = walkInClientSchema.safeParse({ ...valid, phone })
      expect(result.success, `phone "${phone}" should be valid`).toBe(true)
    }
  })

  it("rejects emergencyPhone not matching international format when provided", () => {
    const result = walkInClientSchema.safeParse({ ...valid, emergencyPhone: "055123" })
    expect(result.success).toBe(false)
  })

  it("accepts valid emergencyPhone when provided", () => {
    const result = walkInClientSchema.safeParse({ ...valid, emergencyPhone: "+966551234567" })
    expect(result.success).toBe(true)
  })

  it("accepts when emergencyPhone is omitted", () => {
    const { emergencyPhone: _, ...rest } = valid; void _
    const result = walkInClientSchema.safeParse(rest)
    expect(result.success).toBe(true)
  })

  it("accepts all known blood types", () => {
    for (const bloodType of BLOOD_TYPES) {
      const result = walkInClientSchema.safeParse({ ...valid, bloodType })
      expect(result.success, `bloodType "${bloodType}" should be valid`).toBe(true)
    }
  })

  it("rejects unknown blood type", () => {
    const result = walkInClientSchema.safeParse({ ...valid, bloodType: "Z+" })
    expect(result.success).toBe(false)
  })

  it("accepts optional nationality", () => {
    const result = walkInClientSchema.safeParse({ ...valid, nationality: "SA" })
    expect(result.success).toBe(true)
  })

  it("accepts optional nationalId", () => {
    const result = walkInClientSchema.safeParse({ ...valid, nationalId: "1000000000" })
    expect(result.success).toBe(true)
  })

  it("accepts optional dateOfBirth", () => {
    const result = walkInClientSchema.safeParse({ ...valid, dateOfBirth: "1995-03-15" })
    expect(result.success).toBe(true)
  })

  it("accepts optional middleName", () => {
    const result = walkInClientSchema.safeParse({ ...valid, middleName: "محمد" })
    expect(result.success).toBe(true)
  })

  it("rejects nationality exceeding 100 characters", () => {
    const result = walkInClientSchema.safeParse({ ...valid, nationality: "A".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("rejects nationalId exceeding 20 characters", () => {
    const result = walkInClientSchema.safeParse({ ...valid, nationalId: "1".repeat(21) })
    expect(result.success).toBe(false)
  })

  it("rejects allergies exceeding 1000 characters", () => {
    const result = walkInClientSchema.safeParse({ ...valid, allergies: "أ".repeat(1001) })
    expect(result.success).toBe(false)
  })

  it("accepts optional gender", () => {
    const result = walkInClientSchema.safeParse({ ...valid, gender: "female" })
    expect(result.success).toBe(true)
  })

  it("accepts optional gender undefined", () => {
    const { gender: _g, ...rest } = { ...valid }
    void _g
    const result = walkInClientSchema.safeParse(rest)
    expect(result.success).toBe(true)
  })
})

describe("createWalkInClientSchema", () => {
  const t = (key: string) => key

  it("returns a schema that accepts valid minimal payload", () => {
    const schema = createWalkInClientSchema(t)
    const result = schema.safeParse({
      firstName: "نورة",
      lastName: "العتيبي",
      phone: "+966501234567",
    })
    expect(result.success).toBe(true)
  })

  it("returns a schema that rejects phone missing the leading +", () => {
    const schema = createWalkInClientSchema(t)
    const result = schema.safeParse({
      firstName: "نورة",
      lastName: "العتيبي",
      phone: "966501234567",
    })
    expect(result.success).toBe(false)
  })

  it("returns a schema that accepts optional fields when omitted", () => {
    const schema = createWalkInClientSchema(t)
    const result = schema.safeParse({
      firstName: "سارة",
      lastName: "القحطاني",
      phone: "+966501234567",
      gender: "female",
      nationality: "SA",
    })
    expect(result.success).toBe(true)
  })
})
