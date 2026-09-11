import { describe, expect, test } from "vitest"
import { normalizeDeliveryType } from "@/lib/booking-delivery"

describe("normalizeDeliveryType", () => {
  test("accepts the lowercase wire alias and the enum spelling", () => {
    expect(normalizeDeliveryType("online")).toBe("ONLINE")
    expect(normalizeDeliveryType("in_person")).toBe("IN_PERSON")
    expect(normalizeDeliveryType("ONLINE")).toBe("ONLINE")
  })

  test("returns null for empty or unknown values", () => {
    expect(normalizeDeliveryType(null)).toBeNull()
    expect(normalizeDeliveryType(undefined)).toBeNull()
    expect(normalizeDeliveryType("walk_in")).toBeNull()
  })
})
