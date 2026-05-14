import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (k: string) => {
      const map: Record<string, string> = {
        "dashboard.recentActivity": "آخر الأحداث",
        "dashboard.activity.all": "عرض الكل",
        "dashboard.noActivity": "لا يوجد نشاط",
        "dashboard.timeAgo.now": "الآن",
        "dashboard.timeAgo.minutes": "قبل {mins} دقيقة",
        "dashboard.timeAgo.hours": "قبل {hours} ساعة",
        "dashboard.timeAgo.days": "قبل {days} يوم",
      }
      return map[k] ?? k
    },
  }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@sawaa/ui", () => ({
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}))

import { ActivityFeed } from "@/components/features/dashboard/activity-feed"
import type { Notification } from "@/lib/types/notification"

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: "1",
  recipientId: "user-1",
  recipientType: "EMPLOYEE",
  type: "booking_confirmed",
  title: "تم تأكيد الحجز",
  body: "",
  metadata: null,
  isRead: false,
  readAt: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe("ActivityFeed", () => {
  it("renders title", () => {
    render(<ActivityFeed notifications={[]} />)
    expect(screen.getByText("آخر الأحداث")).toBeInTheDocument()
  })

  it("renders empty state when no notifications", () => {
    render(<ActivityFeed notifications={[]} />)
    expect(screen.getByText("لا يوجد نشاط")).toBeInTheDocument()
  })

  it("renders notification title", () => {
    render(<ActivityFeed notifications={[makeNotification({ title: "حجز جديد" })]} />)
    expect(screen.getByText("حجز جديد")).toBeInTheDocument()
  })

  it("renders at most 5 notifications", () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      makeNotification({ id: String(i), title: `إشعار ${i}` })
    )
    render(<ActivityFeed notifications={items} />)
    expect(screen.getAllByText(/إشعار \d/).length).toBe(5)
  })

  it("renders view all link", () => {
    render(<ActivityFeed notifications={[]} />)
    expect(screen.getByRole("link")).toHaveAttribute("href", "/notifications")
  })
})
