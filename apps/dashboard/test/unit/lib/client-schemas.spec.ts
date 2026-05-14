import { describe, expect, it } from "vitest"
import { walkInClientSchema } from "@/lib/schemas/booking.schema"
import {
  createClientSchema,
  editClientSchema,
} from "@/lib/schemas/client.schema"

describe("client schemas", () => {
  it("accepts a valid walk-in payload with O_NEG blood type", () => {
    const result = walkInClientSchema.safeParse({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      emergencyPhone: "+966500000111",
      bloodType: "O_NEG",
      allergies: "Dust",
      chronicConditions: "Asthma",
    })

    expect(result.success).toBe(true)
  })

  it("rejects walk-in payloads without E.164 phone numbers", () => {
    const result = walkInClientSchema.safeParse({
      firstName: "محمد",
      lastName: "السالم",
      phone: "0501234567",
    })

    expect(result.success).toBe(false)
  })

  it("rejects invalid emergency phone format", () => {
    const result = walkInClientSchema.safeParse({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      emergencyPhone: "0501234567",
    })

    expect(result.success).toBe(false)
  })

  it("rejects unsupported blood type values", () => {
    const result = walkInClientSchema.safeParse({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      bloodType: "X+",
    })

    expect(result.success).toBe(false)
  })

  it("rejects allergies longer than 1000 chars", () => {
    const result = walkInClientSchema.safeParse({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      allergies: "a".repeat(1001),
    })

    expect(result.success).toBe(false)
  })

  it("rejects chronicConditions longer than 1000 chars", () => {
    const result = walkInClientSchema.safeParse({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      chronicConditions: "a".repeat(1001),
    })

    expect(result.success).toBe(false)
  })

  it("rejects create-client payloads with too-long first names", () => {
    const result = createClientSchema.safeParse({
      firstName: "أ".repeat(256),
      lastName: "السالم",
      phone: "+966501234567",
    })

    expect(result.success).toBe(false)
  })

  it("rejects edit-client payloads with too-long nationalId", () => {
    const result = editClientSchema.safeParse({
      nationalId: "123456789012345678901",
    })

    expect(result.success).toBe(false)
  })

  it("rejects edit-client payloads with non-E.164 phone values", () => {
    const result = editClientSchema.safeParse({
      phone: "0501234567",
    })

    expect(result.success).toBe(false)
  })
})
