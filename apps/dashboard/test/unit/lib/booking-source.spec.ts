import { describe, expect, test } from "vitest"
import { bookingChannelKey } from "@/lib/booking-source"

describe("bookingChannelKey", () => {
  test("names every channel a booking can come from", () => {
    expect(bookingChannelKey("RECEPTION")).toBe("detail.bookingChannel.reception")
    expect(bookingChannelKey("ONLINE")).toBe("detail.bookingChannel.online")
    expect(bookingChannelKey("WHATSAPP")).toBe("detail.bookingChannel.whatsapp")
    expect(bookingChannelKey("AI_CHAT")).toBe("detail.bookingChannel.aiChat")
  })

  test("falls back to reception for an unknown or missing value", () => {
    expect(bookingChannelKey(undefined)).toBe("detail.bookingChannel.reception")
    expect(bookingChannelKey("SOMETHING_NEW")).toBe("detail.bookingChannel.reception")
  })
})
