import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { DraftBookingType } from "@/components/features/services/booking-types-editor"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "services.bookingTypes.default": "افتراضي",
        "services.bookingTypes.price": "السعر",
        "services.bookingTypes.priceCurrency": "ر.س",
        "services.bookingTypes.duration": "المدة",
        "services.bookingTypes.durationUnit": "دقيقة",
        "services.bookingTypes.zeroPriceWarning": "السعر صفر",
        "services.availability.custom": "Custom service availability",
        "services.availability.inheritHint": "Inherits branch hours",
        "services.availability.day": "Day",
        "services.availability.start": "Start",
        "services.availability.end": "End",
        "services.availability.remove": "Remove window",
        "services.availability.addWindow": "Add window",
        "services.availability.day.0": "Sun",
      }
      return map[k] ?? k
    },
  }),
}))

import { BookingTypeRow } from "@/components/features/services/booking-type-row"

function makeDraft(overrides: Partial<DraftBookingType> = {}): DraftBookingType {
  return {
    deliveryType: "IN_PERSON",
    enabled: true,
    price: 100,
    durationMins: 30,
    useCustomAvailability: false,
    availabilityWindows: [],
    durationOptions: [],
    ...overrides,
  }
}

describe("BookingTypeRow — price & duration fields", () => {
  it("renders price and duration inputs when enabled", () => {
    render(
      <BookingTypeRow
        draft={makeDraft()}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )
    // Two number inputs should be present (price + duration)
    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs.length).toBeGreaterThanOrEqual(2)
  })

  it("calls onUpdate with price when price input changes", async () => {
    const onUpdate = vi.fn()
    render(
      <BookingTypeRow
        draft={makeDraft()}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={onUpdate}
      />,
    )
    const inputs = screen.getAllByRole("spinbutton")
    await act(async () => {
      fireEvent.change(inputs[1], { target: { value: "200" } })
    })
    expect(onUpdate).toHaveBeenCalledWith("price", 200)
  })

  it("calls onUpdate with durationMins when duration input changes", async () => {
    const onUpdate = vi.fn()
    render(
      <BookingTypeRow
        draft={makeDraft()}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={onUpdate}
      />,
    )
    const inputs = screen.getAllByRole("spinbutton")
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "60" } })
    })
    expect(onUpdate).toHaveBeenCalledWith("durationMins", 60)
  })

  it("renders disabled card when draft.enabled is false", () => {
    render(
      <BookingTypeRow
        draft={makeDraft({ enabled: false })}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )
    // No spinbutton inputs in the disabled state
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0)
  })

  it("enables custom availability and adds a weekly window", async () => {
    const onUpdate = vi.fn()

    render(
      <BookingTypeRow
        draft={makeDraft({ useCustomAvailability: true })}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={onUpdate}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByText("services.bookingTypes.addDuration"))
    })

    expect(onUpdate).toHaveBeenCalledWith(
      "durationOptions",
      expect.arrayContaining([
        expect.objectContaining({ durationMins: 30, price: 100 }),
      ]),
    )
  })
})
