import { describe, expect, it } from "vitest"
import { verifyTransferSchema, addCreditSchema } from "@/lib/schemas/payment.schema"

describe("verifyTransferSchema", () => {
  it("accepts approve action", () => {
    const result = verifyTransferSchema.safeParse({ action: "approve" })
    expect(result.success).toBe(true)
  })

  it("accepts reject action with adminNotes", () => {
    const result = verifyTransferSchema.safeParse({ action: "reject", adminNotes: "Invalid receipt" })
    expect(result.success).toBe(true)
  })

  it("rejects unknown action value", () => {
    const result = verifyTransferSchema.safeParse({ action: "pending" })
    expect(result.success).toBe(false)
  })

  it("rejects missing action", () => {
    const result = verifyTransferSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("addCreditSchema", () => {
  it("accepts valid amount", () => {
    const result = addCreditSchema.safeParse({ amount: 100 })
    expect(result.success).toBe(true)
  })

  it("rejects zero amount", () => {
    const result = addCreditSchema.safeParse({ amount: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects negative amount", () => {
    const result = addCreditSchema.safeParse({ amount: -5 })
    expect(result.success).toBe(false)
  })

  it("rejects note longer than 500 chars", () => {
    const result = addCreditSchema.safeParse({ amount: 50, note: "a".repeat(501) })
    expect(result.success).toBe(false)
  })
})
