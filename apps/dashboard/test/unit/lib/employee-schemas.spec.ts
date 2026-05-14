import { describe, expect, it } from "vitest"
import {
  editEmployeeServiceSchema,
  assignServiceSchema,
} from "@/lib/schemas/employee.schema"

describe("editEmployeeServiceSchema", () => {
  it("accepts valid buffer and active flag", () => {
    const result = editEmployeeServiceSchema.safeParse({ bufferMinutes: 10, isActive: true })
    expect(result.success).toBe(true)
  })

  it("accepts zero buffer", () => {
    const result = editEmployeeServiceSchema.safeParse({ bufferMinutes: 0, isActive: false })
    expect(result.success).toBe(true)
  })

  it("rejects negative buffer", () => {
    const result = editEmployeeServiceSchema.safeParse({ bufferMinutes: -1, isActive: true })
    expect(result.success).toBe(false)
  })
})

describe("assignServiceSchema", () => {
  it("accepts valid assignment payload", () => {
    const result = assignServiceSchema.safeParse({
      serviceId: "svc-1",
      bufferMinutes: 5,
      isActive: true,
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing serviceId", () => {
    const result = assignServiceSchema.safeParse({ bufferMinutes: 5, isActive: true })
    expect(result.success).toBe(false)
  })

  it("rejects empty serviceId", () => {
    const result = assignServiceSchema.safeParse({ serviceId: "", bufferMinutes: 5, isActive: true })
    expect(result.success).toBe(false)
  })
})
