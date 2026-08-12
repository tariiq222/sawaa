import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Booking } from "@/lib/types/booking"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "ar" }),
}))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ canDo: () => true }),
}))
vi.mock("@/components/features/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  PaymentStatusBadge: ({ label }: { label: string }) => <span>{label}</span>,
}))
vi.mock("@/components/features/bookings/record-payment-dialog", () => ({
  RecordPaymentDialog: () => <div>record-payment-dialog</div>,
}))

import { PaymentStatusCell } from "@/components/features/bookings/booking-column-cells"

function historicalBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    bookingNumber: 1001,
    clientId: "client-1",
    employeeId: "employee-1",
    serviceId: "service-1",
    employeeServiceId: "",
    type: "individual",
    deliveryType: "IN_PERSON",
    source: "RECEPTION",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
    status: "confirmed",
    isHistoricalImport: true,
    historicalPayment: {
      status: "paid",
      amount: 20000,
      method: "local",
      requiresReview: false,
    },
    payment: null,
    invoice: null,
    priceSnapshot: 20000,
    client: null,
    employee: null as unknown as Booking["employee"],
    service: null as unknown as Booking["service"],
    employeeService: null,
    rescheduledFrom: null,
    checkedInAt: null,
    notes: null,
    zoomJoinUrl: null,
    zoomHostUrl: null,
    zoomMeetingStatus: null,
    zoomMeetingError: null,
    cancellationReason: null,
    cancelledBy: null,
    suggestedRefundType: null,
    adminNotes: null,
    cancelledAt: null,
    confirmedAt: null,
    completedAt: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    intakeFormId: null,
    intakeFormAlreadySubmitted: false,
    durationMinutesSnapshot: 60,
    branchNameSnapshot: "الفرع الرئيسي",
    employeeNameSnapshot: "الممارس القديم",
    categoryNameSnapshot: "خدمات النظام القديم",
    ...overrides,
  } as Booking
}

describe("historical booking payment", () => {
  it("shows the original paid status with a legacy marker instead of unpaid", () => {
    render(<PaymentStatusCell booking={historicalBooking()} />)

    expect(screen.getByText("bookings.col.historicalPayment.paid")).toBeInTheDocument()
    expect(screen.getByText("bookings.col.historicalPayment.legacyMarker")).toBeInTheDocument()
    expect(screen.queryByText("bookings.col.paymentStatus.unpaid")).not.toBeInTheDocument()
    expect(screen.queryByText("record-payment-dialog")).not.toBeInTheDocument()
  })

  it("shows review-required for ambiguous historical paid records", () => {
    render(<PaymentStatusCell booking={historicalBooking({
      status: "cancelled",
      historicalPayment: {
        status: "paid",
        amount: 20000,
        method: "local",
        requiresReview: true,
      },
    })} />)

    expect(screen.getByText("bookings.col.historicalPayment.review")).toBeInTheDocument()
  })
})
