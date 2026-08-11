import { describe, expect, it } from "vitest"
import { formatNotificationBody } from "@/lib/format-notification-body"

describe("formatNotificationBody", () => {
  it("converts legacy payment notification amounts from halalas to SAR", () => {
    expect(
      formatNotificationBody({
        type: "PAYMENT_COMPLETED",
        body: "تم استلام دفع بقيمة 17500 SAR",
      }),
    ).toBe("تم استلام دفع بقيمة 175.00 SAR")
  })

  it("leaves already formatted payment amounts unchanged", () => {
    expect(
      formatNotificationBody({
        type: "PAYMENT_COMPLETED",
        body: "تم استلام دفع بقيمة 175.00 SAR",
      }),
    ).toBe("تم استلام دفع بقيمة 175.00 SAR")
  })

  it("does not alter non-payment notifications", () => {
    expect(
      formatNotificationBody({
        type: "BOOKING_CREATED",
        body: "تم إنشاء حجز جديد #0052",
      }),
    ).toBe("تم إنشاء حجز جديد #0052")
  })
})
