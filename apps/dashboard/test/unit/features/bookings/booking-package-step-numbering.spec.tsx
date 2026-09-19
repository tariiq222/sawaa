import React from "react"
import { render } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { PackagesCreditSections } from "@/components/features/bookings/booking-pos-track-sections"
import type { BookingFormState } from "@/components/features/bookings/use-booking-form-state"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }))
vi.mock("@/components/features/bookings/wizard-steps/step-type-duration", () => ({
  StepTypeDuration: () => <div />,
}))
vi.mock("@/components/features/bookings/wizard-steps/step-datetime", () => ({
  StepDatetime: () => <div />,
}))

const state = {
  employeeId: "employee-1",
  serviceId: "service-1",
} as BookingFormState

const summaries = {
  typeDuration: "حضوري",
  datetime: "2026-09-14",
} as Record<string, string | null>

describe("PackagesCreditSections step numbering", () => {
  test("uses steps 4 and 5 for the pinned package path", () => {
    const { container } = render(
      <PackagesCreditSections
        state={state}
        openSection="typeDuration"
        setOpenSection={vi.fn()}
        summaries={summaries as never}
        canShowTypeDuration={false}
        canShowDatetime={false}
        selectedDurationMins={null}
        maxAdvanceDays={90}
        onSelectDeliveryType={vi.fn()}
        onSelectDuration={vi.fn()}
        onSelectDate={vi.fn()}
        onSelectTime={vi.fn()}
      />,
    )

    const stepFor = (section: string) =>
      container.querySelector(`[data-section="${section}"] button > div > div`)
        ?.textContent
    expect(stepFor("typeDuration")).toBe("4")
    expect(stepFor("datetime")).toBe("5")
  })
})
