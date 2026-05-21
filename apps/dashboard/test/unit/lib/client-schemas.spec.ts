import { describe, expect, it } from "vitest"
import { walkInClientSchema } from "@/lib/schemas/booking.schema"
import {
  createClientSchema,
  editClientSchema,
  splitFullName,
} from "@/lib/schemas/client.schema"

describe("splitFullName", () => {
  it("splits 1 part into firstName and lastName", () => {
    expect(splitFullName("محمد")).toEqual({ firstName: "محمد", lastName: "محمد" })
  })

  it("splits 2 parts into firstName and lastName", () => {
    expect(splitFullName("محمد السالم")).toEqual({ firstName: "محمد", lastName: "السالم" })
  })

  it("splits 3 parts into firstName, middleName, and lastName", () => {
    expect(splitFullName("محمد عبدالله السالم")).toEqual({
      firstName: "محمد",
      middleName: "عبدالله",
      lastName: "السالم",
    })
  })

  it("splits 4+ parts with middleName as middle parts joined", () => {
    expect(splitFullName("محمد عبدالله أحمد السالم")).toEqual({
      firstName: "محمد",
      middleName: "عبدالله أحمد",
      lastName: "السالم",
    })
  })

  it("trims and collapses whitespace", () => {
    expect(splitFullName("  محمد   عبدالله   السالم  ")).toEqual({
      firstName: "محمد",
      middleName: "عبدالله",
      lastName: "السالم",
    })
  })

  it("returns empty strings for whitespace-only input", () => {
    expect(splitFullName("   ")).toEqual({ firstName: "", lastName: "" })
  })
})

describe("client schemas", () => {
  it("accepts a valid walk-in payload with O_NEG blood type", () => {
    const result = walkInClientSchema.safeParse({
      fullName: "محمد السالم",
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
      fullName: "محمد السالم",
      phone: "0501234567",
    })

    expect(result.success).toBe(false)
  })

  it("rejects invalid emergency phone format", () => {
    const result = walkInClientSchema.safeParse({
      fullName: "محمد السالم",
      phone: "+966501234567",
      emergencyPhone: "0501234567",
    })

    expect(result.success).toBe(false)
  })

  it("rejects unsupported blood type values", () => {
    const result = walkInClientSchema.safeParse({
      fullName: "محمد السالم",
      phone: "+966501234567",
      bloodType: "X+",
    })

    expect(result.success).toBe(false)
  })

  it("rejects allergies longer than 1000 chars", () => {
    const result = walkInClientSchema.safeParse({
      fullName: "محمد السالم",
      phone: "+966501234567",
      allergies: "a".repeat(1001),
    })

    expect(result.success).toBe(false)
  })

  it("rejects chronicConditions longer than 1000 chars", () => {
    const result = walkInClientSchema.safeParse({
      fullName: "محمد السالم",
      phone: "+966501234567",
      chronicConditions: "a".repeat(1001),
    })

    expect(result.success).toBe(false)
  })

  it("rejects create-client payloads with too-long full names", () => {
    const result = createClientSchema.safeParse({
      fullName: "أ".repeat(256),
      phone: "+966501234567",
    })

    expect(result.success).toBe(false)
  })

  it("rejects whitespace-only fullName", () => {
    const result = createClientSchema.safeParse({
      fullName: "   ",
      phone: "+966501234567",
    })

    expect(result.success).toBe(false)
  })

  it("accepts a valid fullName after trimming", () => {
    const result = createClientSchema.safeParse({
      fullName: "  محمد السالم  ",
      phone: "+966501234567",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fullName).toBe("محمد السالم")
    }
  })

  it("rejects edit-client payloads with too-long nationalId", () => {
    const result = editClientSchema.safeParse({
      fullName: "محمد السالم",
      nationalId: "123456789012345678901",
    })

    expect(result.success).toBe(false)
  })

  it("rejects edit-client payloads with non-E.164 phone values", () => {
    const result = editClientSchema.safeParse({
      fullName: "محمد السالم",
      phone: "0501234567",
    })

    expect(result.success).toBe(false)
  })
})
