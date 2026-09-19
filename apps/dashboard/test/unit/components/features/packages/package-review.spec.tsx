import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"
import { translations } from "@/lib/translations"
import type { PackageFormData } from "@/lib/schemas/package.schema"
import { PackageReview } from "@/components/features/packages/package-review"

const language = vi.hoisted(() => ({ locale: "ar" as "ar" | "en" }))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: language.locale,
    t: (key: string) => translations[language.locale][key] ?? key,
  }),
}))
vi.mock("@/hooks/use-employees", () => ({
  useAllEmployees: () => ({ employees: [{ id: "owner", name: "Owner" }] }),
}))
vi.mock("@/hooks/use-services", () => ({
  useAllServices: () => ({ data: [{ id: "service", nameAr: "الجلسة", nameEn: "Session" }] }),
}))

function ReviewHarness({ mode }: { mode: "ANY" | "INCLUDE" | "EXCLUDE" }) {
  const form = useForm<PackageFormData>({ defaultValues: {
    nameAr: "باقة التجربة", ownerEmployeeId: "owner",
    items: [{
      selectionMode: "FLEXIBLE", paidQuantity: 1, freeQuantity: 0,
      service: { mode: "INCLUDE", ids: ["service"] },
      practitioner: { mode: "INCLUDE", ids: ["owner"] },
      duration: { mode, ids: mode === "ANY" ? [] : ["duration"] },
      delivery: { mode: "INCLUDE", ids: ["IN_PERSON"] },
    }],
  } })
  // The review must translate from raw data even while the preceding item row
  // is unmounted and its cached Arabic labels cannot be refreshed.
  const detail = {
    serviceName: "الجلسة", practitionerName: "Owner", durationName: "الكل",
    deliveryName: "حضوري", durations: [{ id: "duration", durationMins: 30, deliveryType: "IN_PERSON" }],
    paidQuantity: 1, freeQuantity: 0, unitPrice: 10000, discountType: null,
    discountValue: 0, discountAmount: 0, net: 10000, priceAvailable: true,
  }
  return <PackageReview form={form} lineItems={[detail]} breakdown={{
    subtotal: 10000, discountAmount: 0, finalPrice: 10000,
    fullValue: 10000, freeValue: 0, totalSavings: 0, lines: [],
  }} />
}

describe("PackageReview locale changes", () => {
  it.each([
    ["ANY", "All"],
    ["INCLUDE", "Only: In-person · 30 min"],
    ["EXCLUDE", "Except: In-person · 30 min"],
  ] as const)("refreshes %s scope labels while review stays mounted", (mode, duration) => {
    language.locale = "ar"
    const { rerender } = render(<ReviewHarness mode={mode} />)
    expect(screen.getByRole("heading", { name: "مراجعة الباقة" })).toBeVisible()

    language.locale = "en"
    rerender(<ReviewHarness mode={mode} />)

    expect(screen.getByText(`Service: Only: Session · Practitioner: Only: Owner · Duration: ${duration} · Attendance: Only: In-person`)).toBeVisible()
    expect(screen.getByText(/Paid sessions: 1 .*Session price: 100.00 .*Final price: 100.00/)).toBeVisible()
  })
})
