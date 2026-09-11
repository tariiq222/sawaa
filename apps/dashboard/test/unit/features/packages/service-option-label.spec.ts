import { describe, expect, test } from "vitest"
import { serviceOptionLabel } from "@/components/features/packages/service-option-label"

const clinic = (mode: "DIRECT" | "SERVICES", nameAr = "عيادة السعادة", nameEn: string | null = "Happiness Clinic") => ({
  id: "c1",
  nameAr,
  nameEn,
  bookingMode: mode,
})

describe("serviceOptionLabel", () => {
  test("hidden service of a direct-booking clinic shows the clinic name", () => {
    const s = { nameAr: "خدمة داخلية", nameEn: "internal", isHidden: true, category: clinic("DIRECT") }
    expect(serviceOptionLabel(s as never, "ar")).toBe("عيادة السعادة")
    expect(serviceOptionLabel(s as never, "en")).toBe("Happiness Clinic")
  })

  test("visible service inside a clinic shows clinic › service", () => {
    const s = {
      nameAr: "مقاييس نفسية",
      nameEn: "Psychological Scales",
      isHidden: false,
      category: clinic("SERVICES", "القياس والتقويم", "Assessment"),
    }
    expect(serviceOptionLabel(s as never, "ar")).toBe("القياس والتقويم › مقاييس نفسية")
    expect(serviceOptionLabel(s as never, "en")).toBe("Assessment › Psychological Scales")
  })

  test("service without a clinic shows its own name, falling back to Arabic", () => {
    const s = { nameAr: "استشارة", nameEn: null, isHidden: false, category: null }
    expect(serviceOptionLabel(s as never, "en")).toBe("استشارة")
  })
})
