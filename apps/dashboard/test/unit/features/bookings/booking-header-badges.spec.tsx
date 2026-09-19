import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { BookingHeaderBadges } from "@/components/features/bookings/booking-header-badges"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "ar" }),
}))

vi.mock("@sawaa/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/features/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>status:{status}</span>,
  BookingTypeBadge: ({ type }: { type: string }) => <span>type:{type}</span>,
}))

describe("BookingHeaderBadges", () => {
  test("an individual online booking shows the online delivery label, not in-person", () => {
    render(
      <BookingHeaderBadges
        booking={{ type: "in_person", deliveryType: "online", status: "completed" } as never}
      />,
    )
    expect(screen.getByText("bookings.col.type.online")).toBeInTheDocument()
    expect(screen.queryByText("bookings.col.type.inPerson")).not.toBeInTheDocument()
    expect(screen.queryByText(/^type:/)).not.toBeInTheDocument()
    expect(screen.getByText("status:completed")).toBeInTheDocument()
  })

  test("a group booking keeps its booking-type badge next to the delivery label", () => {
    render(
      <BookingHeaderBadges
        booking={{ type: "group", deliveryType: "in_person", status: "confirmed" } as never}
      />,
    )
    expect(screen.getByText("bookings.col.type.inPerson")).toBeInTheDocument()
    expect(screen.getByText("type:group")).toBeInTheDocument()
  })
})
