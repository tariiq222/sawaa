import React from "react"
import { render, screen } from "@testing-library/react"
import { test, expect, vi } from "vitest"
import { DetailsBody } from "@/components/features/bookings/booking-details-body"
import type { Booking } from "@/lib/types/booking"

vi.mock("@sawaa/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock("@/components/features/status-badge", () => ({
  PaymentStatusBadge: ({ label }: { label: string }) => <span>{label}</span>,
}))

vi.mock("@/components/features/detail-sheet-parts", () => ({
  DetailRow: ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
    <div><span>{label}</span><span>{value}</span></div>
  ),
}))

vi.mock("@/components/features/shared/sar-symbol", () => ({
  FormattedCurrency: () => <span>currency</span>,
}))

vi.mock("@/hooks/use-zoom-config", () => ({
  useRetryBookingZoom: () => ({ mutate: vi.fn(), isPending: false }),
}))

const booking = {
  id: "booking-1",
  source: "RECEPTION",
  startTime: "10:00",
  endTime: "11:00",
  packageFunding: {
    creditId: "credit-1",
    purchaseId: "purchase-1",
    packageId: "package-1",
    packageNameAr: "باقة الأسرة",
    packageNameEn: "Family package",
    usageStatus: "CONSUMED",
  },
  service: { nameAr: "استشارة", nameEn: "Consultation", duration: 60 },
} as unknown as Booking

test("shows package name and consumed funding status in booking details", () => {
  render(
    <DetailsBody
      booking={booking}
      clientName="عميل"
      employeeName="أخصائي"
      specialty="أسري"
      appointmentDate="2026-08-31"
      bookedAt="2026-08-30"
      locale="ar"
      t={(key) => key}
    />,
  )

  expect(screen.getByRole("link", { name: "باقة الأسرة" })).toHaveAttribute("href", "/packages/package-1")
  expect(screen.getByText("bookings.packageFunding.status.consumed")).toBeInTheDocument()
})
