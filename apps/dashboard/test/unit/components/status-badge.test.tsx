import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { BookingStatus, BookingType } from "@/lib/types/booking"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  ),
}))

vi.mock("@sawaa/ui", () => ({
  Badge: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}))

import { StatusBadge, BookingTypeBadge } from "@/components/features/status-badge"

describe("StatusBadge", () => {
  it("renders pending status with warning styles", () => {
    const { container } = render(<StatusBadge status="pending" />)
    expect(container.querySelector(".text-warning")).toBeTruthy()
  })

  it("renders confirmed status with success styles", () => {
    const { container } = render(<StatusBadge status="confirmed" />)
    expect(container.querySelector(".text-success")).toBeTruthy()
  })

  it("renders cancelled status with destructive styles", () => {
    const { container } = render(<StatusBadge status="cancelled" />)
    expect(container.querySelector(".text-destructive")).toBeTruthy()
  })

  it("renders completed status with accent styles", () => {
    const { container } = render(<StatusBadge status="completed" />)
    expect(container.querySelector(".text-accent")).toBeTruthy()
  })

  it("renders no_show status with destructive styles", () => {
    const { container } = render(<StatusBadge status="no_show" />)
    expect(container.querySelector(".text-destructive")).toBeTruthy()
  })

  it("renders expired status with muted styles", () => {
    const { container } = render(<StatusBadge status="expired" />)
    expect(container.querySelector(".text-muted-foreground")).toBeTruthy()
  })

  it("renders cancel_requested with warning styles", () => {
    const { container } = render(<StatusBadge status="cancel_requested" />)
    expect(container.querySelector(".text-warning")).toBeTruthy()
  })

  it("renders awaiting_payment with warning styles", () => {
    const { container } = render(<StatusBadge status="awaiting_payment" />)
    expect(container.querySelector(".text-warning")).toBeTruthy()
  })

  it("renders pending_group_fill with warning styles", () => {
    const { container } = render(<StatusBadge status="pending_group_fill" />)
    expect(container.querySelector(".text-warning")).toBeTruthy()
  })

  it("renders unknown status as plain badge with fallback text", () => {
    const { container } = render(<StatusBadge status={"invalid_status" as BookingStatus} />)
    expect(container.textContent).toContain("invalid_status")
  })

  it("renders with custom className", () => {
    const { container } = render(<StatusBadge status="confirmed" className="custom-class" />)
    expect(container.querySelector(".custom-class")).toBeTruthy()
  })
})

describe("BookingTypeBadge", () => {
  it("renders in_person type with primary styles", () => {
    const { container } = render(<BookingTypeBadge type="in_person" />)
    expect(container.querySelector(".text-primary")).toBeTruthy()
  })

  it("renders online type with info styles", () => {
    const { container } = render(<BookingTypeBadge type="online" />)
    expect(container.querySelector(".text-info")).toBeTruthy()
  })

  it("renders walk_in type with success styles", () => {
    const { container } = render(<BookingTypeBadge type="walk_in" />)
    expect(container.querySelector(".text-success")).toBeTruthy()
  })

  it("renders group type with accent styles", () => {
    const { container } = render(<BookingTypeBadge type="group" />)
    expect(container.querySelector(".text-accent")).toBeTruthy()
  })

  it("renders unknown type as plain badge with fallback text", () => {
    const { container } = render(<BookingTypeBadge type={"invalid_type" as BookingType} />)
    expect(container.textContent).toContain("invalid_type")
  })
})
