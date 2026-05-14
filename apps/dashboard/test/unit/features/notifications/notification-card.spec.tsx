import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
}))

import { NotificationCard } from "@/components/features/notifications/notification-card"
import type { Notification } from "@/lib/types/notification"

const base: Notification = {
  id: "n-1",
  recipientId: "u-1",
  recipientType: "CLIENT" as Notification["recipientType"],
  type: "booking.confirmed",
  title: "New booking confirmed",
  body: "Sara Ali booked Cardiology at 10:00.",
  metadata: null,
  isRead: false,
  readAt: null,
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  updatedAt: new Date(Date.now() - 60_000).toISOString(),
}

describe("NotificationCard", () => {
  it("renders title and body", () => {
    render(<NotificationCard notification={base} onMarkRead={() => {}} />)
    expect(screen.getByText(base.title)).toBeTruthy()
    expect(screen.getByText(base.body)).toBeTruthy()
  })

  it("shows an unread dot when isRead is false", () => {
    const { container } = render(<NotificationCard notification={base} onMarkRead={() => {}} />)
    expect(container.querySelector(".bg-primary")).not.toBeNull()
  })

  it("does not show the unread dot when isRead is true", () => {
    const { container } = render(
      <NotificationCard notification={{ ...base, isRead: true }} onMarkRead={() => {}} />,
    )
    // Read state renders an empty placeholder div (no bg-primary circle).
    const card = container.querySelector("[data-testid='notification-card']")
    expect(card?.querySelector(".bg-primary.rounded-full, .bg-primary.size-2\\.5")).toBeNull()
  })

  it("calls onMarkRead with the notification id when an unread card is clicked", () => {
    const onMarkRead = vi.fn()
    render(<NotificationCard notification={base} onMarkRead={onMarkRead} />)
    fireEvent.click(screen.getByTestId("notification-card"))
    expect(onMarkRead).toHaveBeenCalledWith("n-1")
  })

  it("does not call onMarkRead when an already-read card is clicked", () => {
    const onMarkRead = vi.fn()
    render(
      <NotificationCard notification={{ ...base, isRead: true }} onMarkRead={onMarkRead} />,
    )
    fireEvent.click(screen.getByTestId("notification-card"))
    expect(onMarkRead).not.toHaveBeenCalled()
  })

  it("renders a relative time string for createdAt", () => {
    render(<NotificationCard notification={base} onMarkRead={() => {}} />)
    // e.g. "1 minute ago" — don't pin to exact copy; just assert a time suffix appears.
    expect(screen.getByText(/ago/i)).toBeTruthy()
  })
})
