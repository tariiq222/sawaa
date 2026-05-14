import { describe, expect, it } from "vitest"
import {
  DAY_NAMES_EN,
  DAY_NAME_KEYS,
  nextBreakKey,
} from "@/components/features/employees/create/schedule-types"

describe("DAY_NAMES_EN / DAY_NAME_KEYS", () => {
  it("are 7-tuples starting at Sunday", () => {
    expect(DAY_NAMES_EN).toHaveLength(7)
    expect(DAY_NAME_KEYS).toHaveLength(7)
    expect(DAY_NAMES_EN[0]).toBe("Sunday")
    expect(DAY_NAME_KEYS[0]).toBe("employees.day.0")
  })

  it("DAY_NAME_KEYS align index-by-index with JS day numbers", () => {
    DAY_NAME_KEYS.forEach((key, i) => {
      expect(key).toBe(`employees.day.${i}`)
    })
  })
})

describe("nextBreakKey", () => {
  it("produces monotonically distinct keys", () => {
    const keys = new Set<string>()
    for (let i = 0; i < 5; i++) keys.add(nextBreakKey())
    expect(keys.size).toBe(5)
    for (const k of keys) expect(k).toMatch(/^brk-\d+$/)
  })
})
