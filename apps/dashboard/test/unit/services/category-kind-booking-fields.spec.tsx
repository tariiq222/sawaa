import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "en" }),
}))

import { CategoryKindBookingFields, resolveEffectiveCategoryKind } from "@/components/features/services/category-kind-booking-fields"
import { buildCategoryCreatePayload, buildCategoryUpdatePayload } from "@/components/features/services/category-create-payload"

function CreateFields() {
  const [kind, setKind] = useState<"CLINIC" | "SERVICE_GROUP">("CLINIC")
  const [bookingMode, setBookingMode] = useState<"DIRECT" | "SERVICES">("DIRECT")
  return (
    <CategoryKindBookingFields
      kind={kind}
      bookingMode={bookingMode}
      mode="create"
      onKindChange={setKind}
      onBookingModeChange={setBookingMode}
    />
  )
}

function EditGroupFields({ onPayload }: { onPayload: (payload: ReturnType<typeof buildCategoryUpdatePayload>) => void }) {
  const [watchedKind, setKind] = useState<"CLINIC" | "SERVICE_GROUP">("SERVICE_GROUP")
  const kind = resolveEffectiveCategoryKind("edit", watchedKind, "SERVICE_GROUP")
  const bookingMode = "SERVICES" as const
  return (
    <>
      <CategoryKindBookingFields
        kind={kind}
        bookingMode={bookingMode}
        mode="edit"
        onKindChange={setKind}
        onBookingModeChange={vi.fn()}
      />
      <button type="button" onClick={() => onPayload(buildCategoryUpdatePayload("cat-1", { kind }, undefined, null))}>Save</button>
    </>
  )
}

describe("CategoryKindBookingFields", () => {
  it("serializes category kind and forces SERVICES for a service group", () => {
    expect(buildCategoryCreatePayload({ nameAr: "خدمات الأسرة", kind: "SERVICE_GROUP", bookingMode: "DIRECT" })).toMatchObject({
      kind: "SERVICE_GROUP",
      bookingMode: "SERVICES",
    })
  })

  it("allows selecting a service group from the default create state and forces SERVICES", () => {
    render(<CreateFields />)
    const group = screen.getByRole("radio", { name: /services\.categories\.kind\.group/ })
    expect(group).toBeEnabled()

    fireEvent.click(group)

    expect(screen.getByRole("radio", { name: /services\.categories\.bookingMode\.services/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: /services\.categories\.bookingMode\.direct/ })).toBeDisabled()
  })

  it("locks booking mode on edit and prevents a DIRECT clinic becoming a service group", () => {
    render(
      <CategoryKindBookingFields
        kind="CLINIC"
        bookingMode="DIRECT"
        mode="edit"
        onKindChange={vi.fn()}
        onBookingModeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole("radio", { name: /services\.categories\.bookingMode\.direct/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: /services\.categories\.bookingMode\.direct/ })).toBeDisabled()
    expect(screen.getByRole("radio", { name: /services\.categories\.bookingMode\.services/ })).toBeDisabled()
    expect(screen.getByRole("radio", { name: /services\.categories\.kind\.group/ })).toBeDisabled()
  })

  it("reflects an edit selection for an existing SERVICES group in the saved category payload", () => {
    const onPayload = vi.fn()
    render(<EditGroupFields onPayload={onPayload} />)

    const clinic = screen.getByRole("radio", { name: /services\.categories\.kind\.clinic/ })
    fireEvent.click(clinic)
    expect(clinic).toBeChecked()

    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onPayload).toHaveBeenCalledWith(expect.objectContaining({ id: "cat-1", kind: "CLINIC" }))
    expect(onPayload.mock.calls[0][0]).not.toHaveProperty("bookingMode")
  })
})
