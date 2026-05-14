import { describe, expect, it } from "vitest"
import {
  addServiceSchema,
  nextDraftKey,
} from "@/components/features/employees/create/draft-service.types"

describe("addServiceSchema", () => {
  it("accepts a valid payload", () => {
    const ok = addServiceSchema.safeParse({ serviceId: "svc-1", bufferMinutes: 15, isActive: true })
    expect(ok.success).toBe(true)
  })

  it("rejects missing serviceId", () => {
    expect(addServiceSchema.safeParse({ serviceId: "", bufferMinutes: 0, isActive: true }).success).toBe(false)
  })

  it("coerces bufferMinutes from string and rejects negatives", () => {
    const coerced = addServiceSchema.safeParse({ serviceId: "s", bufferMinutes: "10", isActive: true })
    expect(coerced.success).toBe(true)
    if (coerced.success) expect(coerced.data.bufferMinutes).toBe(10)
    expect(addServiceSchema.safeParse({ serviceId: "s", bufferMinutes: -1, isActive: true }).success).toBe(false)
  })

  it("rejects a non-integer bufferMinutes", () => {
    expect(addServiceSchema.safeParse({ serviceId: "s", bufferMinutes: 1.5, isActive: true }).success).toBe(false)
  })
})

describe("nextDraftKey", () => {
  it("returns a unique draft key prefixed with draft-svc-", () => {
    const a = nextDraftKey()
    const b = nextDraftKey()
    expect(a).toMatch(/^draft-svc-\d+$/)
    expect(a).not.toBe(b)
  })
})
