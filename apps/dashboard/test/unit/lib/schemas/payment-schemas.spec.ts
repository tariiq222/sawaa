import { describe, expect, it } from "vitest"
import { verifyTransferSchema, addCreditSchema } from "@/lib/schemas/payment.schema"

describe("verifyTransferSchema", () => {
  it("accepts approve / reject actions", () => {
    expect(verifyTransferSchema.safeParse({ action: "approve" }).success).toBe(true)
    expect(verifyTransferSchema.safeParse({ action: "reject" }).success).toBe(true)
  })

  it("rejects any other action value", () => {
    expect(verifyTransferSchema.safeParse({ action: "skip" }).success).toBe(false)
  })

  it("requires action", () => {
    expect(verifyTransferSchema.safeParse({}).success).toBe(false)
  })

  it("accepts an optional transferRef", () => {
    expect(verifyTransferSchema.safeParse({ action: "approve", transferRef: "TR-42" }).success).toBe(true)
  })
})

describe("addCreditSchema", () => {
  it("coerces string amounts and accepts them when > 0", () => {
    const parsed = addCreditSchema.safeParse({ amount: "25.5" })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.amount).toBe(25.5)
  })

  it("rejects amount of 0 and negative amounts", () => {
    expect(addCreditSchema.safeParse({ amount: 0 }).success).toBe(false)
    expect(addCreditSchema.safeParse({ amount: -1 }).success).toBe(false)
  })

  it("accepts an optional note up to 500 chars", () => {
    expect(addCreditSchema.safeParse({ amount: 10, note: "x".repeat(500) }).success).toBe(true)
    expect(addCreditSchema.safeParse({ amount: 10, note: "x".repeat(501) }).success).toBe(false)
  })
})
