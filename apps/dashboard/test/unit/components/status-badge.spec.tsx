import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "ar", dir: "rtl" }),
}))

vi.mock("@/lib/ds", () => ({
  bookingStatusStyles: {
    pending: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
    confirmed: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
    completed: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
    cancelled: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
  },
  bookingTypeStyles: {
    in_person: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    online: { bg: "bg-info/10", text: "text-info", border: "border-info/20" },
    walk_in: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
  },
}))

import { StatusBadge, BookingTypeBadge } from "@/components/features/status-badge"

describe("StatusBadge", () => {
  it("renders translated status for known status", () => {
    render(<StatusBadge status="confirmed" />)
    expect(screen.getByText("bookings.status.confirmed")).toBeInTheDocument()
  })

  it("renders raw status for unknown status", () => {
    render(<StatusBadge status={"unknown_status" as never} />)
    expect(screen.getByText("unknown_status")).toBeInTheDocument()
  })

  it("applies className", () => {
    const { container } = render(<StatusBadge status="pending" className="extra-class" />)
    expect(container.querySelector(".extra-class")).toBeInTheDocument()
  })

  it("renders all valid statuses", () => {
    const statuses = ["pending", "confirmed", "completed", "cancelled"] as const
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(screen.getByText(`bookings.status.${status}`)).toBeInTheDocument()
      unmount()
    }
  })
})

describe("BookingTypeBadge", () => {
  it("renders translated type for known type", () => {
    render(<BookingTypeBadge type="in_person" />)
    expect(screen.getByText("bookings.type.inPerson")).toBeInTheDocument()
  })

  it("renders raw type for unknown type", () => {
    render(<BookingTypeBadge type={"unknown" as never} />)
    expect(screen.getByText("unknown")).toBeInTheDocument()
  })
})
