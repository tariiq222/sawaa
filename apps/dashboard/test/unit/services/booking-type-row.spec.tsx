import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { DraftDurationOption, DraftBookingType } from "@/components/features/services/booking-types-editor"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "services.bookingTypes.default": "افتراضي",
        "services.bookingTypes.removeOption": "حذف",
        "services.bookingTypes.durationMinLabel": "المدة (دقيقة)",
        "services.bookingTypes.priceSARLabel": "السعر (ر.س)",
        "services.bookingTypes.labelEn": "التسمية (EN)",
        "services.bookingTypes.labelAr": "التسمية (AR)",
        "services.bookingTypes.placeholderEn": "e.g. Standard",
        "services.bookingTypes.placeholderAr": "مثال: عادي",
      }
      return map[k] ?? k
    },
  }),
}))

import { BookingTypeRow } from "@/components/features/services/booking-type-row"

function makeDraft(option: DraftDurationOption): DraftBookingType {
  return {
    bookingType: "IN_PERSON", // DB-10: enum value is now uppercase
    enabled: true,
    price: 100,
    durationMins: 30,
    durationOptions: [option],
  }
}

describe("DurationOptionMiniRow (via BookingTypeRow) — labelEn + labelAr", () => {
  const baseOption: DraftDurationOption = {
    key: "opt-1",
    label: "",
    labelAr: "",
    durationMins: 30,
    price: 0,
    isDefault: false,
    sortOrder: 0,
  }

  it("renders labelEn input", () => {
    render(
      <BookingTypeRow
        draft={makeDraft(baseOption)}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateOptions={vi.fn()}
      />,
    )
    expect(screen.getByPlaceholderText(/placeholderEn/i)).toBeInTheDocument()
  })

  it("renders labelAr input", () => {
    render(
      <BookingTypeRow
        draft={makeDraft(baseOption)}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateOptions={vi.fn()}
      />,
    )
    expect(screen.getByPlaceholderText(/placeholderAr/i)).toBeInTheDocument()
  })

  it("editing labelEn calls onUpdateOptions with label field and new value", async () => {
    const onUpdateOptions = vi.fn()
    const opt = { ...baseOption }

    render(
      <BookingTypeRow
        draft={makeDraft(opt)}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateOptions={onUpdateOptions}
      />,
    )

    const labelEnInput = screen.getByPlaceholderText(/placeholderEn/i)

    // Use act + fireEvent to properly trigger React's onChange
    await act(async () => {
      fireEvent.change(labelEnInput, { target: { value: "Standard" } })
    })

    expect(onUpdateOptions).toHaveBeenCalled()
    const calls = onUpdateOptions.mock.calls
    const lastCall = calls[calls.length - 1]?.[0] as DraftDurationOption[]
    const updated = lastCall?.find((o) => o.key === "opt-1")
    expect(updated?.label).toBe("Standard")
  })

  it("editing labelAr calls onUpdateOptions with labelAr field and new value", async () => {
    const onUpdateOptions = vi.fn()
    const opt = { ...baseOption }

    render(
      <BookingTypeRow
        draft={makeDraft(opt)}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateOptions={onUpdateOptions}
      />,
    )

    const labelArInput = screen.getByPlaceholderText(/placeholderAr/i)

    await act(async () => {
      fireEvent.change(labelArInput, { target: { value: "عادي" } })
    })

    expect(onUpdateOptions).toHaveBeenCalled()
    const calls = onUpdateOptions.mock.calls
    const lastCall = calls[calls.length - 1]?.[0] as DraftDurationOption[]
    const updated = lastCall?.find((o) => o.key === "opt-1")
    expect(updated?.labelAr).toBe("عادي")
  })

  it("renders both labelEn and labelAr inputs simultaneously", () => {
    render(
      <BookingTypeRow
        draft={makeDraft(baseOption)}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateOptions={vi.fn()}
      />,
    )
    expect(screen.getByPlaceholderText(/placeholderEn/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/placeholderAr/i)).toBeInTheDocument()
  })

  it("pre-fills labelEn from option.label value", () => {
    render(
      <BookingTypeRow
        draft={makeDraft({ ...baseOption, label: "Premium" })}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateOptions={vi.fn()}
      />,
    )
    expect(screen.getByDisplayValue("Premium")).toBeInTheDocument()
  })

  it("pre-fills labelAr from option.labelAr value", () => {
    render(
      <BookingTypeRow
        draft={makeDraft({ ...baseOption, labelAr: "مميز" })}
        label="In-Person"
        isAr={false}
        t={(k: string) => k}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateOptions={vi.fn()}
      />,
    )
    expect(screen.getByDisplayValue("مميز")).toBeInTheDocument()
  })
})
