import { describe, expect, it } from "vitest"
import {
  userBaseSchema,
  userCreateSchema,
  userEditSchema,
  createRoleSchema,
} from "@/lib/schemas/user.schema"

const validBase = {
  email: "a@clinic.test",
  name: "Sara Ali",
  phone: "+966501234567",
  gender: "FEMALE" as const,
}

describe("userBaseSchema", () => {
  it("accepts a valid payload", () => {
    expect(userBaseSchema.safeParse(validBase).success).toBe(true)
  })

  it("rejects malformed email", () => {
    expect(userBaseSchema.safeParse({ ...validBase, email: "nope" }).success).toBe(false)
  })

  it("requires a non-empty name", () => {
    expect(userBaseSchema.safeParse({ ...validBase, name: "" }).success).toBe(false)
  })

  it("accepts an empty phone string and rejects non-E.164 phones", () => {
    expect(userBaseSchema.safeParse({ ...validBase, phone: "" }).success).toBe(true)
    expect(userBaseSchema.safeParse({ ...validBase, phone: "not-a-phone" }).success).toBe(false)
  })

  it("rejects unknown gender values", () => {
    expect(userBaseSchema.safeParse({ ...validBase, gender: "other" }).success).toBe(false)
  })
})

describe("userCreateSchema", () => {
  const validCreate = { ...validBase, password: "Password1", role: "ADMIN" as const }

  it("accepts a complete create payload", () => {
    expect(userCreateSchema.safeParse(validCreate).success).toBe(true)
  })

  it("requires password of length >= 8", () => {
    expect(userCreateSchema.safeParse({ ...validCreate, password: "short" }).success).toBe(false)
  })

  it("rejects an unknown role", () => {
    expect(userCreateSchema.safeParse({ ...validCreate, role: "GOD" }).success).toBe(false)
  })

  it("accepts each documented USER_ROLES enum value", () => {
    for (const role of ["ADMIN", "RECEPTIONIST", "ACCOUNTANT", "EMPLOYEE"] as const) {
      expect(userCreateSchema.safeParse({ ...validCreate, role }).success).toBe(true)
    }
  })

  it("rejects platform and client-only roles from organization user creation", () => {
    expect(userCreateSchema.safeParse({ ...validCreate, role: "SUPER_ADMIN" }).success).toBe(false)
    expect(userCreateSchema.safeParse({ ...validCreate, role: "CLIENT" }).success).toBe(false)
  })
})

describe("userEditSchema", () => {
  it("makes role optional compared to the create schema", () => {
    const { password: _password, ...rest } = { ...validBase, password: "Password1", role: "ADMIN" as const }
    expect(userEditSchema.safeParse(rest).success).toBe(true)
    expect(userEditSchema.safeParse({ email: "a@b.co", name: "A" }).success).toBe(true)
  })
})

describe("createRoleSchema", () => {
  it("requires a non-empty role name", () => {
    expect(createRoleSchema.safeParse({ name: "" }).success).toBe(false)
    expect(createRoleSchema.safeParse({ name: "Cashier" }).success).toBe(true)
  })

  it("rejects unsupported description payloads that the backend does not persist", () => {
    expect(createRoleSchema.safeParse({ name: "Cashier", description: "Handles POS" }).success).toBe(false)
  })
})
