/**
 * Programs zod schema — unit tests
 *
 * Covers:
 *  - createProgramSchema: required fields, defaults, refinements
 *    (minParticipants ≤ maxParticipants, depositSar ≤ priceSar)
 *  - toCreateProgramPayload: SAR → integer halalas conversion, depositAmount
 *    handling, field-name mapping to backend DTO shape
 *  - scheduleProgramSchema: requires startDate
 *  - cancelProgramSchema: requires reason ≥ 2 chars
 *  - enrollInProgramSchema: requires a UUID clientId
 *  - halalasStringToSar: Prisma-Decimal-string → SAR number conversion
 *  - halalasField export
 */

import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  createProgramSchema,
  scheduleProgramSchema,
  cancelProgramSchema,
  enrollInProgramSchema,
  toCreateProgramPayload,
  halalasStringToSar,
  halalasField,
  type CreateProgramFormValues,
} from "@/lib/schemas/program.schema"

const DEPT_ID = "5a0e2c1d-9f3b-4c8a-b1d2-3e4f5a6b7c8d"
const BRANCH_ID = "6b1f3d2e-0a4c-4d9b-92e3-4f5a6b7c8d9e"
const SUPERVISOR_ID = "7c2f4e3f-1b5d-4eac-a3f4-5a6b7c8d9e0f"

function validProgram(): CreateProgramFormValues {
  return {
    departmentId: DEPT_ID,
    branchId: BRANCH_ID,
    nameAr: "برنامج تدريبي",
    daysCount: 5,
    hoursPerDay: 4,
    minParticipants: 5,
    maxParticipants: 20,
    priceSar: 1000,
    currency: "SAR",
    depositEnabled: false,
    isPublic: false,
    supervisorIds: [SUPERVISOR_ID],
  }
}

describe("createProgramSchema", () => {
  it("accepts a valid payload", () => {
    const r = createProgramSchema.safeParse(validProgram())
    expect(r.success).toBe(true)
  })

  it("rejects a non-uuid departmentId", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      departmentId: "not-a-uuid",
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("departmentId")
    }
  })

  it("rejects a non-uuid branchId", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      branchId: "branch-1",
    })
    expect(r.success).toBe(false)
  })

  it("rejects a nameAr shorter than 2 characters", () => {
    const r = createProgramSchema.safeParse({ ...validProgram(), nameAr: "أ" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("nameAr")
    }
  })

  it("rejects zero or negative daysCount / hoursPerDay / minParticipants / maxParticipants", () => {
    const fields = ["daysCount", "hoursPerDay", "minParticipants", "maxParticipants"] as const
    for (const f of fields) {
      const r = createProgramSchema.safeParse({ ...validProgram(), [f]: 0 })
      expect(r.success).toBe(false)
      if (!r.success) {
        const issue = r.error.issues.find((i) => i.path[0] === f)
        expect(issue).toBeDefined()
      }
    }
  })

  it("rejects when minParticipants > maxParticipants", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      minParticipants: 30,
      maxParticipants: 10,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("minParticipants")
    }
  })

  it("accepts equal minParticipants and maxParticipants (single-participant program)", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      minParticipants: 1,
      maxParticipants: 1,
    })
    expect(r.success).toBe(true)
  })

  it("rejects negative priceSar", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      priceSar: -1,
    })
    expect(r.success).toBe(false)
  })

  it("rejects depositSar > priceSar when deposit is enabled", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      depositEnabled: true,
      depositSar: 1500,
      priceSar: 1000,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("depositSar")
    }
  })

  it("requires depositSar when depositEnabled is true and it is missing", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      depositEnabled: true,
      // depositSar omitted
      priceSar: 1000,
    })
    expect(r.success).toBe(false)
  })

  it("accepts depositSar equal to priceSar", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      depositEnabled: true,
      depositSar: 1000,
      priceSar: 1000,
    })
    expect(r.success).toBe(true)
  })

  it("requires at least one supervisor", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      supervisorIds: [],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "supervisorIds")
      expect(issue?.message).toBe("At least one supervisor is required")
    }
  })

  it("rejects a non-uuid supervisorId", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      supervisorIds: ["not-a-uuid"],
    })
    expect(r.success).toBe(false)
  })

  it("defaults currency to 'SAR' and isPublic / depositEnabled to false", () => {
    const r = createProgramSchema.safeParse({
      ...validProgram(),
      currency: undefined,
      isPublic: undefined,
      depositEnabled: undefined,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.currency).toBe("SAR")
      expect(r.data.isPublic).toBe(false)
      expect(r.data.depositEnabled).toBe(false)
    }
  })
})

describe("toCreateProgramPayload", () => {
  it("converts priceSar to integer halalas (price)", () => {
    const values = validProgram()
    const payload = toCreateProgramPayload({ ...values, priceSar: 1234.56 })
    expect(payload.price).toBe(123456)
  })

  it("rounds to nearest integer hala (no fractional SAR in the payload)", () => {
    const payload = toCreateProgramPayload({ ...validProgram(), priceSar: 99.999 })
    expect(payload.price).toBe(10000)
  })

  it("converts depositSar to depositAmount in halalas when present", () => {
    const payload = toCreateProgramPayload({
      ...validProgram(),
      depositEnabled: true,
      depositSar: 250.5,
    })
    expect(payload.depositAmount).toBe(25050)
  })

  it("sets depositAmount to undefined when no depositSar provided", () => {
    const payload = toCreateProgramPayload(validProgram())
    expect(payload.depositAmount).toBeUndefined()
  })

  it("maps schema field names to backend DTO field names", () => {
    const payload = toCreateProgramPayload(validProgram())
    expect(payload).not.toHaveProperty("priceSar")
    expect(payload).not.toHaveProperty("depositSar")
    expect(payload).toHaveProperty("price")
    expect(payload).toHaveProperty("depositAmount")
  })

  it("forwards optional descriptions and isPublic verbatim", () => {
    const payload = toCreateProgramPayload({
      ...validProgram(),
      nameEn: "Training Program",
      descriptionAr: "وصف",
      descriptionEn: "Description",
      isPublic: true,
      publicDescriptionAr: "وصف عام",
      publicDescriptionEn: "Public description",
    })
    expect(payload.nameEn).toBe("Training Program")
    expect(payload.descriptionAr).toBe("وصف")
    expect(payload.descriptionEn).toBe("Description")
    expect(payload.isPublic).toBe(true)
    expect(payload.publicDescriptionAr).toBe("وصف عام")
    expect(payload.publicDescriptionEn).toBe("Public description")
  })

  it("forwards the supervisorIds array unchanged", () => {
    const payload = toCreateProgramPayload(validProgram())
    expect(payload.supervisorIds).toEqual([SUPERVISOR_ID])
  })
})

describe("scheduleProgramSchema", () => {
  it("accepts an ISO startDate", () => {
    const r = scheduleProgramSchema.safeParse({ startDate: "2026-07-01" })
    expect(r.success).toBe(true)
  })

  it("rejects an empty startDate", () => {
    const r = scheduleProgramSchema.safeParse({ startDate: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("startDate")
      expect(r.error.issues[0]?.message).toBe("startDate is required")
    }
  })

  it("rejects a missing startDate", () => {
    const r = scheduleProgramSchema.safeParse({})
    expect(r.success).toBe(false)
  })
})

describe("cancelProgramSchema", () => {
  it("accepts a reason ≥ 2 characters", () => {
    const r = cancelProgramSchema.safeParse({ reason: "إلغاء إداري" })
    expect(r.success).toBe(true)
  })

  it("rejects a reason of 1 character", () => {
    const r = cancelProgramSchema.safeParse({ reason: "a" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("reason")
      expect(r.error.issues[0]?.message).toBe("Reason is required")
    }
  })

  it("rejects an empty reason", () => {
    const r = cancelProgramSchema.safeParse({ reason: "" })
    expect(r.success).toBe(false)
  })
})

describe("enrollInProgramSchema", () => {
  it("accepts a valid uuid clientId", () => {
    const r = enrollInProgramSchema.safeParse({ clientId: SUPERVISOR_ID })
    expect(r.success).toBe(true)
  })

  it("rejects a non-uuid clientId", () => {
    const r = enrollInProgramSchema.safeParse({ clientId: "client-1" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("clientId")
    }
  })

  it("rejects a missing clientId", () => {
    const r = enrollInProgramSchema.safeParse({})
    expect(r.success).toBe(false)
  })
})

describe("halalasStringToSar", () => {
  it("converts a Prisma Decimal-string (halalas) to SAR number", () => {
    expect(halalasStringToSar("12345")).toBe(123.45)
  })

  it("returns 0 for null and undefined", () => {
    expect(halalasStringToSar(null)).toBe(0)
    expect(halalasStringToSar(undefined)).toBe(0)
  })

  it("returns 0 for an empty string", () => {
    expect(halalasStringToSar("")).toBe(0)
  })

  it("returns 0 for a non-numeric string", () => {
    expect(halalasStringToSar("not-a-number")).toBe(0)
  })

  it("handles zero halalas (0 SAR)", () => {
    expect(halalasStringToSar("0")).toBe(0)
  })
})

describe("halalasField", () => {
  it("rejects negative values", () => {
    const r = halalasField.safeParse(-1)
    expect(r.success).toBe(false)
  })

  it("rejects non-integer values", () => {
    const r = halalasField.safeParse(1.5)
    expect(r.success).toBe(false)
  })

  it("accepts 0 and positive integers", () => {
    expect(halalasField.safeParse(0).success).toBe(true)
    expect(halalasField.safeParse(1).success).toBe(true)
    expect(halalasField.safeParse(999999).success).toBe(true)
  })

  it("is a non-negative integer schema (z.Number kind)", () => {
    expect(halalasField).toBeInstanceOf(z.ZodNumber)
  })
})
