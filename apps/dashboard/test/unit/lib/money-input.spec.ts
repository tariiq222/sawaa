import { describe, expect, it } from "vitest"
import {
  moneyInputToHalalas,
  normalizeMoneyInput,
  parseMoneyInput,
} from "@/lib/money-input"

describe("money input", () => {
  it("normalizes Arabic-Indic and Persian digits", () => {
    expect(normalizeMoneyInput("٢٢٥٫٥٠")).toBe("225.50")
    expect(normalizeMoneyInput("۲۲۵٫۵۰")).toBe("225.50")
  })

  it("accepts decimal separators used by Arabic/Persian keyboards", () => {
    expect(parseMoneyInput("225،50")).toBe(225.5)
    expect(parseMoneyInput("2٬225٫50")).toBe(2225.5)
  })

  it("rejects malformed and negative values before conversion", () => {
    expect(parseMoneyInput("12.3.4")).toBeNull()
    expect(parseMoneyInput("-12")).toBeNull()
    expect(moneyInputToHalalas("not-a-number")).toBeNull()
  })

  it("converts valid SAR input to integer halalas", () => {
    expect(moneyInputToHalalas("٢٢٥٫٥٠")).toBe(22550)
  })
})
