import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { BookingSummary } from "@/components/features/bookings/booking-summary"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "ar" }),
}))
vi.mock("@/hooks/use-organization-config", () => ({
  useOrganizationConfig: () => ({
    formatDate: (value: string) => value,
    formatTime: (value: string) => value,
  }),
}))
vi.mock("@/components/features/shared/sar-symbol", () => ({
  FormattedCurrency: ({ amount }: { amount: number }) => <span>currency:{amount}</span>,
}))
vi.mock("@/components/features/bookings/collection-timing-section", () => ({
  CollectionTimingSection: () => <div>collection-timing</div>,
}))
vi.mock("@sawaa/ui", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

const baseProps = {
  clientName: "مستفيد",
  serviceName: "عيادة السعادة",
  employeeName: "د. خالد",
  type: "IN_PERSON",
  durationLabel: "60 دقيقة",
  date: "2026-09-14",
  startTime: "13:00",
  servicePriceHalalas: 40_000,
  payAtClinic: true,
  collectionMethod: "CASH" as const,
  paymentSettings: undefined,
  couponCode: null,
  submitting: false,
  isComplete: true,
  onTogglePayAtClinic: vi.fn(),
  onChangeCollectionMethod: vi.fn(),
  onCouponChange: vi.fn(),
  onSubmit: vi.fn(),
}

describe("BookingSummary — package-funded booking", () => {
  test("shows the session as funded by the package instead of the service price", () => {
    render(<BookingSummary {...baseProps} hideCollectionTiming fundedByPackage />)

    expect(screen.getByText("bookings.pos.summary.fromPackage")).toBeInTheDocument()
    expect(screen.queryByText("currency:40000")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("bookings.wizard.step.confirm.couponPlaceholder")).not.toBeInTheDocument()
    expect(screen.queryByText("collection-timing")).not.toBeInTheDocument()
  })

  test("a paid booking still shows the service price and coupon field", () => {
    render(<BookingSummary {...baseProps} hideCollectionTiming={false} />)

    expect(screen.getByText("currency:40000")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("bookings.wizard.step.confirm.couponPlaceholder")).toBeInTheDocument()
    expect(screen.queryByText("bookings.pos.summary.fromPackage")).not.toBeInTheDocument()
  })

  test("shows the selected package, session, service, and unreserved balance", () => {
    render(
      <BookingSummary
        {...baseProps}
        hideCollectionTiming
        fundedByPackage
        packageSummary={{
          packageName: "Family package",
          sessionPosition: 2,
          serviceName: "Consultation",
          remaining: 3,
        }}
      />,
    )

    expect(screen.getByTestId("booking-package-summary")).toHaveTextContent("Family package")
    expect(screen.getByTestId("booking-package-summary")).toHaveTextContent("3")
    expect(screen.getByTestId("booking-package-summary")).toHaveTextContent("Consultation")
    expect(screen.getByText("bookings.pos.summary.packageSession")).toBeInTheDocument()
    expect(screen.getByText("bookings.pos.summary.packageUnreservedBalance")).toBeInTheDocument()
  })

  test("does not render package details when the paid path is active", () => {
    render(
      <BookingSummary
        {...baseProps}
        hideCollectionTiming={false}
        packageSummary={{
          packageName: "Stale package",
          sessionPosition: 0,
          serviceName: "Stale service",
          remaining: 9,
        }}
      />,
    )

    expect(screen.queryByTestId("booking-package-summary")).not.toBeInTheDocument()
    expect(screen.queryByText("Stale package")).not.toBeInTheDocument()
  })
})
