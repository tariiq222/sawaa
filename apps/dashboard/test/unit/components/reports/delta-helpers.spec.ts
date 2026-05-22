import { describe, expect, it } from "vitest"
import { computeDelta } from "@/components/features/reports/delta-helpers"

describe("computeDelta", () => {
  it("returns undefined when previous is missing", () => {
    expect(computeDelta(100, undefined)).toBeUndefined()
  })

  it("returns flat tone when values are equal", () => {
    expect(computeDelta(50, 50)).toEqual({ text: "ثابت", tone: "flat" })
  })

  it("returns up tone when current exceeds previous", () => {
    const d = computeDelta(120, 100)
    expect(d?.tone).toBe("up")
    expect(d?.text).toContain("+20")
  })

  it("returns down tone when current is below previous", () => {
    const d = computeDelta(80, 100)
    expect(d?.tone).toBe("down")
    expect(d?.text).toContain("−20")
  })

  it("inverts tone when inverse=true (lower is better)", () => {
    const decrease = computeDelta(0.05, 0.1, { inverse: true })
    expect(decrease?.tone).toBe("up")
    const increase = computeDelta(0.15, 0.1, { inverse: true })
    expect(increase?.tone).toBe("down")
  })

  it("uses count format when requested", () => {
    const d = computeDelta(15, 10, { format: "count" })
    expect(d?.text).toBe("+5")
  })

  it("handles previous=0 specially", () => {
    const d = computeDelta(10, 0)
    expect(d?.text).toBe("+جديد")
    expect(d?.tone).toBe("up")
  })
})
