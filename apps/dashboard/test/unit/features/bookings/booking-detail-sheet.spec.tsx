import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Booking } from "@/lib/types/booking"

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ locale: "en", t: (key: string) => key }) }))
vi.mock("@/hooks/use-organization-config", () => ({ useOrganizationConfig: () => ({ formatDate: (date: string) => date }) }))
vi.mock("@/components/features/bookings/booking-actions", () => ({ BookingActions: () => null }))
vi.mock("@/components/features/bookings/booking-header-badges", () => ({ BookingHeaderBadges: () => null }))
vi.mock("@/components/features/bookings/booking-details-body", () => ({ DetailsBody: () => null }))
vi.mock("@/components/features/bookings/booking-intake-responses", () => ({ BookingIntakeResponses: () => null }))
vi.mock("@/components/features/bookings/booking-reschedule-tab", () => ({ BookingRescheduleTab: () => null }))
vi.mock("@/components/features/bookings/booking-timeline", () => ({ BookingTimeline: () => null }))
vi.mock("@/components/features/bookings/booking-invoice-tab", () => ({ BookingInvoiceTab: () => null }))

import { BookingDetailSheet } from "@/components/features/bookings/booking-detail-sheet"

const booking = { id: "deposit-1", status: "deposit_paid", date: "2026-10-10", createdAt: "2026-10-01T10:00:00Z" } as Booking

describe("BookingDetailSheet deposit rescheduling", () => {
  it("offers the reschedule tab for an operationally confirmed deposit booking", () => {
    render(<BookingDetailSheet booking={booking} open onOpenChange={vi.fn()} onAction={vi.fn()} defaultTab="reschedule" />)
    expect(screen.getByRole("tab", { name: "detail.tabs.reschedule" })).toHaveAttribute("aria-selected", "true")
  })

  it("keeps historical deposit bookings read-only", () => {
    render(<BookingDetailSheet booking={{ ...booking, isHistoricalImport: true }} open onOpenChange={vi.fn()} onAction={vi.fn()} defaultTab="reschedule" />)
    expect(screen.queryByRole("tab", { name: "detail.tabs.reschedule" })).toBeNull()
    expect(screen.getByRole("tab", { name: "detail.tabs.details" })).toHaveAttribute("aria-selected", "true")
  })
})
