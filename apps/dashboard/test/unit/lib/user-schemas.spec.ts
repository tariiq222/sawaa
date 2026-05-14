import { describe, expect, it } from "vitest"
import {
  userBaseSchema,
  userCreateSchema,
  userEditSchema,
  createRoleSchema,
} from "@/lib/schemas/user.schema"

describe("userBaseSchema", () => {
  it("accepts a valid user payload", () => {
    const result = userBaseSchema.safeParse({
      email: "user@example.com",
      name: "أحمد السالم",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email format", () => {
    const result = userBaseSchema.safeParse({
      email: "not-an-email",
      name: "أحمد السالم",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = userBaseSchema.safeParse({
      email: "user@example.com",
      name: "",
    })
    expect(result.success).toBe(false)
  })

  it("accepts optional E.164 phone", () => {
    const result = userBaseSchema.safeParse({
      email: "user@example.com",
      name: "أحمد السالم",
      phone: "+966501234567",
    })
    expect(result.success).toBe(true)
  })

  it("rejects non-E.164 phone", () => {
    const result = userBaseSchema.safeParse({
      email: "user@example.com",
      name: "أحمد السالم",
      phone: "0501234567",
    })
    expect(result.success).toBe(false)
  })
})

describe("userCreateSchema", () => {
  it("accepts a valid create payload with password and role", () => {
    const result = userCreateSchema.safeParse({
      email: "user@example.com",
      name: "أحمد السالم",
      password: "securepass",
      role: "RECEPTIONIST",
    })
    expect(result.success).toBe(true)
  })

  it("rejects password shorter than 8 characters", () => {
    const result = userCreateSchema.safeParse({
      email: "user@example.com",
      name: "أحمد السالم",
      password: "short",
      role: "RECEPTIONIST",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing role", () => {
    const result = userCreateSchema.safeParse({
      email: "user@example.com",
      name: "أحمد السالم",
      password: "securepass",
    })
    expect(result.success).toBe(false)
  })
})

describe("userEditSchema", () => {
  it("accepts partial payload — role is optional", () => {
    const result = userEditSchema.safeParse({
      email: "user@example.com",
      name: "أحمد السالم",
    })
    expect(result.success).toBe(true)
  })
})

describe("createRoleSchema", () => {
  it("accepts a valid role name", () => {
    const result = createRoleSchema.safeParse({ name: "Receptionist" })
    expect(result.success).toBe(true)
  })

  it("rejects empty role name", () => {
    const result = createRoleSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })
})
