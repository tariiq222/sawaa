import { describe, expect, it } from "vitest"

import {
  parseNonNegativeInt,
  resolveAutomationDelay,
} from "@/components/features/settings/cancellation-tab"

describe("parseNonNegativeInt", () => {
  it("returns 0 for the literal string \"0\" (must NOT fall back to default)", () => {
    expect(parseNonNegativeInt("0", 2)).toBe(0)
  })

  it("returns 0 for a whitespace-padded zero", () => {
    expect(parseNonNegativeInt("  0  ", 30)).toBe(0)
  })

  it("parses a positive integer and preserves it", () => {
    expect(parseNonNegativeInt("2", 2)).toBe(2)
    expect(parseNonNegativeInt("30", 30)).toBe(30)
    expect(parseNonNegativeInt("120", 30)).toBe(120)
  })

  it("trims surrounding whitespace from a positive integer", () => {
    expect(parseNonNegativeInt("  2  ", 30)).toBe(2)
  })

  it("falls back to the default when the input is empty", () => {
    expect(parseNonNegativeInt("", 2)).toBe(2)
    expect(parseNonNegativeInt("   ", 30)).toBe(30)
  })

  it("falls back to the default when the input is not a number", () => {
    expect(parseNonNegativeInt("abc", 30)).toBe(30)
    expect(parseNonNegativeInt("NaN", 2)).toBe(2)
  })

  it("falls back to the default for negative integers", () => {
    expect(parseNonNegativeInt("-1", 2)).toBe(2)
    expect(parseNonNegativeInt("-30", 30)).toBe(30)
  })

  it("falls back to the default for non-integer numbers", () => {
    expect(parseNonNegativeInt("1.5", 2)).toBe(2)
    expect(parseNonNegativeInt("2.0", 2)).toBe(2)
    expect(parseNonNegativeInt("-0.5", 30)).toBe(30)
  })

  it("falls back to the default for Infinity", () => {
    expect(parseNonNegativeInt("Infinity", 2)).toBe(2)
    expect(parseNonNegativeInt("-Infinity", 30)).toBe(30)
  })
})

describe("resolveAutomationDelay", () => {
  it("returns 0 when the switch is OFF, regardless of the raw value", () => {
    expect(resolveAutomationDelay(false, "5", 2)).toBe(0)
    expect(resolveAutomationDelay(false, "0", 30)).toBe(0)
    expect(resolveAutomationDelay(false, "", 30)).toBe(0)
    expect(resolveAutomationDelay(false, "abc", 30)).toBe(0)
  })

  it("returns the parsed positive delay when the switch is ON", () => {
    expect(resolveAutomationDelay(true, "2", 2)).toBe(2)
    expect(resolveAutomationDelay(true, "30", 30)).toBe(30)
    expect(resolveAutomationDelay(true, "120", 30)).toBe(120)
    expect(resolveAutomationDelay(true, "  4  ", 2)).toBe(4)
  })

  it("falls back to the default when ON but raw is \"0\" (number field cannot sneak a 0)", () => {
    expect(resolveAutomationDelay(true, "0", 2)).toBe(2)
    expect(resolveAutomationDelay(true, " 0 ", 30)).toBe(30)
  })

  it("falls back to the default when ON but raw is empty / invalid", () => {
    expect(resolveAutomationDelay(true, "", 2)).toBe(2)
    expect(resolveAutomationDelay(true, "", 30)).toBe(30)
    expect(resolveAutomationDelay(true, "   ", 30)).toBe(30)
    expect(resolveAutomationDelay(true, "abc", 30)).toBe(30)
    expect(resolveAutomationDelay(true, "-1", 2)).toBe(2)
  })
})
