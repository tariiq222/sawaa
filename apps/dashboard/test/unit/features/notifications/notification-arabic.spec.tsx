import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { LocaleProvider } from "@/components/locale-provider"
import { NotificationCard } from "@/components/features/notifications/notification-card"
import { NotificationDropdown } from "@/components/features/notifications/notification-dropdown"
import type { Notification } from "@/lib/types/notification"

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })

const feed = vi.hoisted(() => ({ isError: false, refetch: vi.fn() }))
vi.mock("@/hooks/use-notifications", () => ({
  useDashboardNotifications: () => ({ data: undefined, isLoading: false, ...feed }),
  useUnreadCount: () => ({ data: 0 }),
  useNotificationMutations: () => ({ markAllMut: { mutate: vi.fn() }, markOneMut: { mutate: vi.fn() } }),
}))

const notification = {
  id: "n-ar", type: "NEW_EVENT" as Notification["type"], title: "تحديث بخصوص الموعد",
  recipientId: "u-ar", recipientType: "CLIENT", readAt: null, updatedAt: "2026-09-28T10:00:00Z",
  body: "تفاصيل الموعد المهمة التي ينبغي أن تظهر كاملة دون إخفاء نهاية الرسالة. ".repeat(8),
  isRead: false, createdAt: "2026-09-28T10:00:00Z", metadata: null,
} as Notification

describe("Arabic notification presentation", () => {
  it("uses a readable fallback for unknown notification types", () => {
    render(<LocaleProvider><NotificationCard notification={notification} onMarkRead={vi.fn()} /></LocaleProvider>)
    expect(screen.queryByText("notifications.types.NEW_EVENT")).not.toBeInTheDocument()
    expect(screen.getByText("إشعار عام")).toBeVisible()
  })

  it("keeps full message text available instead of clamping the only detail view", () => {
    render(<LocaleProvider><NotificationCard notification={notification} onMarkRead={vi.fn()} /></LocaleProvider>)
    expect(screen.getByText(notification.title)).not.toHaveClass("truncate")
    expect(screen.getByText(notification.body.trim())).not.toHaveClass("line-clamp-2")
  })

  it("labels the notification bell in Arabic", () => {
    render(<LocaleProvider><NotificationDropdown /></LocaleProvider>)
    expect(screen.getByRole("button", { name: "الإشعارات" })).toBeVisible()
  })

  it("does not show an empty inbox when loading notifications fails", async () => {
    feed.isError = true
    try {
      render(<LocaleProvider><NotificationDropdown /></LocaleProvider>)
      await userEvent.setup().click(screen.getByTestId("notifications-bell"))
      expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تحميل الإشعارات")
      expect(screen.queryByText("لا توجد إشعارات")).not.toBeInTheDocument()
      await userEvent.setup().click(screen.getByRole("button", { name: "إعادة المحاولة" }))
      expect(feed.refetch).toHaveBeenCalled()
    } finally {
      feed.isError = false
    }
  })
})
