import { describe, expect, it } from "vitest"
import {
  userBaseSchema,
  userCreateSchema,
  userEditSchema,
  createRoleSchema,
  parseRoleSelection,
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
  // roleSelection is now a free-form string (min 1); the schema no longer
  // enforces a role enum — valid options are constrained by the UI dropdown
  // and assertCanAssignRole on the backend.
  const validCreate = { ...validBase, password: "Password1", roleSelection: "ADMIN" }

  it("accepts a complete create payload", () => {
    expect(userCreateSchema.safeParse(validCreate).success).toBe(true)
  })

  it("requires password of length >= 8", () => {
    expect(userCreateSchema.safeParse({ ...validCreate, password: "short" }).success).toBe(false)
  })

  it("requires a non-empty roleSelection", () => {
    expect(userCreateSchema.safeParse({ ...validCreate, roleSelection: "" }).success).toBe(false)
  })

  it("accepts system role names as roleSelection", () => {
    for (const role of ["ADMIN", "RECEPTIONIST", "ACCOUNTANT", "EMPLOYEE"]) {
      expect(userCreateSchema.safeParse({ ...validCreate, roleSelection: role }).success).toBe(true)
    }
  })

  it("accepts a custom role selection value (custom:<uuid>)", () => {
    const customValue = "custom:550e8400-e29b-41d4-a716-446655440000"
    expect(userCreateSchema.safeParse({ ...validCreate, roleSelection: customValue }).success).toBe(true)
  })

  it("does not enforce SUPER_ADMIN or CLIENT exclusion at schema level (backend assertCanAssignRole handles this)", () => {
    // The schema accepts any non-empty string; role-rank validation is done
    // server-side by assertCanAssignRole and constrained by UI option lists.
    expect(userCreateSchema.safeParse({ ...validCreate, roleSelection: "SUPER_ADMIN" }).success).toBe(true)
    expect(userCreateSchema.safeParse({ ...validCreate, roleSelection: "CLIENT" }).success).toBe(true)
  })
})

describe("userEditSchema", () => {
  it("makes roleSelection optional (edit does not require re-selecting a role)", () => {
    expect(userEditSchema.safeParse({ ...validBase, roleSelection: "ADMIN" }).success).toBe(true)
    expect(userEditSchema.safeParse({ email: "a@b.co", name: "A" }).success).toBe(true)
  })
})

describe("parseRoleSelection", () => {
  it("classifies a built-in role name as system", () => {
    const result = parseRoleSelection("ADMIN")
    expect(result).toEqual({ kind: "system", role: "ADMIN" })
  })

  it("classifies a custom:<uuid> value as custom", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000"
    const result = parseRoleSelection(`custom:${uuid}`)
    expect(result).toEqual({ kind: "custom", customRoleId: uuid })
  })

  it("extracts the UUID portion from a custom selection", () => {
    const result = parseRoleSelection("custom:abc-123")
    expect(result.kind).toBe("custom")
    if (result.kind === "custom") {
      expect(result.customRoleId).toBe("abc-123")
    }
  })

  it("treats any non-custom: prefix as a system role", () => {
    const result = parseRoleSelection("RECEPTIONIST")
    expect(result).toEqual({ kind: "system", role: "RECEPTIONIST" })
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
