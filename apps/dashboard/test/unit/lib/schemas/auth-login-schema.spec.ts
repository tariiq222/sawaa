/**
 * auth-login schema — unit tests
 *
 * The dashboard login form accepts EITHER a valid email OR a Saudi phone
 * number (national 05XXXXXXXX, international +9665XXXXXXXX, or
 * 009665XXXXXXXX). The schema enforces that — and the OTP step enforces a
 * 6-digit code.
 *
 * Covers:
 *  - identifierSchema: valid emails, valid Saudi phones (3 formats),
 *    whitespace/space tolerance, empty + too-short rejection, non-email /
 *    non-phone rejection (INVALID_IDENTIFIER).
 *  - otpCodeSchema: 6-digit code accepted; anything else rejected
 *    (INVALID_OTP).
 */

import { describe, expect, it } from "vitest"
import { identifierSchema, otpCodeSchema } from "@/lib/schemas/auth-login.schema"

describe("identifierSchema — email branch", () => {
  it("accepts a plain email", () => {
    expect(identifierSchema.safeParse("admin@sawaa-test.com").success).toBe(true)
  })

  it("accepts an email with subdomains", () => {
    expect(identifierSchema.safeParse("a.b+c@sub.example.co.uk").success).toBe(true)
  })

  it("accepts an email padded with whitespace (the schema trims internally)", () => {
    expect(identifierSchema.safeParse("  admin@sawaa-test.com  ").success).toBe(true)
  })

  it("rejects an email missing a domain dot", () => {
    const r = identifierSchema.safeParse("admin@sawaa")
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe("INVALID_IDENTIFIER")
  })

  it("rejects an email missing a local part", () => {
    const r = identifierSchema.safeParse("@sawaa-test.com")
    expect(r.success).toBe(false)
  })

  it("rejects a string with no '@' and no Saudi-phone shape", () => {
    const r = identifierSchema.safeParse("not-an-email")
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe("INVALID_IDENTIFIER")
  })
})

describe("identifierSchema — Saudi phone branch", () => {
  it("accepts a national-format phone 05XXXXXXXX", () => {
    expect(identifierSchema.safeParse("0551234567").success).toBe(true)
  })

  it("accepts an international-format phone +9665XXXXXXXX", () => {
    expect(identifierSchema.safeParse("+966551234567").success).toBe(true)
  })

  it("accepts an international-format phone 009665XXXXXXXX", () => {
    // "009665" + 8 digits = 14 chars total
    expect(identifierSchema.safeParse("00966551234567").success).toBe(true)
  })

  it("accepts a national-format phone with whitespace (the schema strips)", () => {
    // The schema does v.trim().replace(/\s/g, "") before regex match.
    expect(identifierSchema.safeParse("055 123 4567").success).toBe(true)
  })

  it("rejects a phone with too few digits", () => {
    const r = identifierSchema.safeParse("055123456")
    expect(r.success).toBe(false)
  })

  it("rejects a phone with too many digits", () => {
    const r = identifierSchema.safeParse("05512345678")
    expect(r.success).toBe(false)
  })

  it("rejects a phone starting with the wrong prefix (4 not 5)", () => {
    const r = identifierSchema.safeParse("0441234567")
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe("INVALID_IDENTIFIER")
  })
})

describe("identifierSchema — empty / boundary", () => {
  it("rejects an empty string with REQUIRED", () => {
    const r = identifierSchema.safeParse("")
    expect(r.success).toBe(false)
    if (!r.success) {
      // Both REQUIRED and INVALID_IDENTIFIER could apply; the first issue
      // is the .min(1) REQUIRED, which we expect to surface.
      expect(r.error.issues[0]?.message).toBe("REQUIRED")
    }
  })

  it("rejects a whitespace-only string", () => {
    const r = identifierSchema.safeParse("   ")
    // After trim it's empty → REQUIRED
    expect(r.success).toBe(false)
  })

  it("does not accept a non-string", () => {
    const r = identifierSchema.safeParse(123 as unknown as string)
    expect(r.success).toBe(false)
  })
})

describe("otpCodeSchema", () => {
  it("accepts a 6-digit numeric code", () => {
    expect(otpCodeSchema.safeParse("123456").success).toBe(true)
    expect(otpCodeSchema.safeParse("000000").success).toBe(true)
    expect(otpCodeSchema.safeParse("999999").success).toBe(true)
  })

  it("rejects a 5-digit code", () => {
    const r = otpCodeSchema.safeParse("12345")
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe("INVALID_OTP")
  })

  it("rejects a 7-digit code", () => {
    const r = otpCodeSchema.safeParse("1234567")
    expect(r.success).toBe(false)
  })

  it("rejects an alpha-numeric code", () => {
    const r = otpCodeSchema.safeParse("abc123")
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe("INVALID_OTP")
  })

  it("rejects a code with whitespace", () => {
    const r = otpCodeSchema.safeParse("123 456")
    expect(r.success).toBe(false)
  })

  it("rejects an empty string", () => {
    const r = otpCodeSchema.safeParse("")
    expect(r.success).toBe(false)
  })
})
