import { describe, expect, it } from "vitest"
import { parseClinicTimeInput } from "@/lib/utils"

describe("parseClinicTimeInput", () => {
  it("accepts Arabic and English suffixes with whitespace", () => {
    expect(parseClinicTimeInput("  ١:٣٠ م  ", "12h")).toBeNull()
    expect(parseClinicTimeInput("  1:30 م  ", "12h")).toBe("13:30")
    expect(parseClinicTimeInput("12:00 AM", "12h")).toBe("00:00")
  })

  it("rejects long suffix-shaped input in linear time", () => {
    const input = `12:00 ${" ".repeat(100_000)}x`
    const started = performance.now()
    expect(parseClinicTimeInput(input, "12h")).toBeNull()
    expect(performance.now() - started).toBeLessThan(250)
  })
})
