import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Conversation } from "@/lib/types/conversations"
import { ConversationList } from "@/components/features/conversations/conversation-list"
import { ConversationDetail } from "@/components/features/conversations/conversation-detail"

const labels: Record<string, string> = {
  "conversations.loading": "جارٍ تحميل المحادثات",
  "conversations.error": "تعذّر تحميل المحادثات",
  "conversations.empty.title": "لا توجد محادثات",
  "conversations.empty.description": "ستظهر المحادثات هنا",
  "conversations.search": "ابحث بالاسم أو الجوال",
  "conversations.filter.all": "الكل",
  "conversations.filter.unread": "غير مقروءة",
  "conversations.status.WAITING_FOR_STAFF": "بانتظار الاستقبال",
  "conversations.status.STAFF_ACTIVE": "مع موظف استقبال",
  "conversations.status.AI_ACTIVE": "مع المساعد",
  "conversations.status.CLOSED": "مغلقة",
  "conversations.guest": "زائر",
  "conversations.detail.select": "اختر محادثة",
  "conversations.detail.selectDescription": "اختر محادثة لعرض الرسائل",
  "conversations.detail.claim": "استلام المحادثة",
  "conversations.detail.release": "إعادة للمساعد",
  "conversations.detail.close": "إغلاق المحادثة",
  "conversations.detail.assignee": "الموظف المسؤول",
  "conversations.detail.unassigned": "غير مسندة",
  "conversations.detail.aiActive": "يدير المساعد هذه المحادثة حالياً",
  "conversations.detail.closed": "هذه المحادثة مغلقة",
  "conversations.detail.messagesLoading": "جارٍ تحميل الرسائل",
  "conversations.detail.messagesError": "تعذّر تحميل الرسائل",
  "conversations.detail.noMessages": "لا توجد رسائل بعد",
  "conversations.composer.label": "الرد",
  "conversations.composer.placeholder": "اكتب ردك",
  "conversations.composer.send": "إرسال",
}

const t = (key: string) => labels[key] ?? key
const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: "conversation-1",
  clientId: null,
  status: "WAITING_FOR_STAFF",
  guestName: "سارة",
  guestPhone: "+966501234567",
  language: "ar",
  assignedStaffUserId: null,
  handoffRequestedAt: "2026-08-14T06:00:00.000Z",
  staffClaimedAt: null,
  closedAt: null,
  staffUnreadCount: 3,
  clientUnreadCount: 0,
  lastMessageAt: "2026-08-14T06:00:00.000Z",
  createdAt: "2026-08-14T05:00:00.000Z",
  updatedAt: "2026-08-14T06:00:00.000Z",
  ...overrides,
})

describe("ConversationList", () => {
  beforeEach(() => { document.documentElement.dir = "rtl" })

  it("renders Arabic status, unread count, and authorized guest identity", () => {
    render(
      <ConversationList
        conversations={[conversation()]}
        selectedId={null}
        filters={{}}
        isLoading={false}
        error={null}
        t={t}
        onFiltersChange={vi.fn()}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText("سارة")).toBeInTheDocument()
    expect(screen.getByText("+966501234567")).toHaveAttribute("dir", "ltr")
    expect(screen.getAllByText("بانتظار الاستقبال")).toHaveLength(2)
    expect(screen.getByLabelText("3 غير مقروءة")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /سارة/ })).toHaveClass("text-start")
  })

  it.each([
    ["WAITING_FOR_STAFF", "بانتظار الاستقبال"],
    ["STAFF_ACTIVE", "مع موظف استقبال"],
    ["AI_ACTIVE", "مع المساعد"],
    ["CLOSED", "مغلقة"],
  ] as const)("renders the %s state", (status, label) => {
    render(
      <ConversationList
        conversations={[conversation({ status, staffUnreadCount: 0 })]}
        selectedId={null}
        filters={{}}
        isLoading={false}
        error={null}
        t={t}
        onFiltersChange={vi.fn()}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: `سارة ${label}` })).toBeInTheDocument()
  })

  it("covers loading, error, and empty states", () => {
    const props = {
      conversations: [], selectedId: null, filters: {}, t,
      onFiltersChange: vi.fn(), onSelect: vi.fn(), onRetry: vi.fn(),
    }
    const { rerender } = render(<ConversationList {...props} isLoading error={null} />)
    expect(screen.getByLabelText("جارٍ تحميل المحادثات")).toBeInTheDocument()

    rerender(<ConversationList {...props} isLoading={false} error={new Error("network")} />)
    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تحميل المحادثات")

    rerender(<ConversationList {...props} isLoading={false} error={null} />)
    expect(screen.getByText("لا توجد محادثات")).toBeInTheDocument()
  })
})

describe("ConversationDetail", () => {
  const handlers = {
    onClaim: vi.fn(), onReply: vi.fn(), onAssign: vi.fn(), onRelease: vi.fn(), onClose: vi.fn(),
  }

  it("offers claim for a waiting conversation and hides the composer", () => {
    render(<ConversationDetail conversation={conversation()} messages={[]} isMessagesLoading={false} messagesError={null} canManage={false} staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.getByRole("button", { name: "استلام المحادثة" })).toBeInTheDocument()
    expect(screen.queryByLabelText("الرد")).not.toBeInTheDocument()
  })

  it("allows reply, release, close, and assignment for an active managed conversation", () => {
    render(<ConversationDetail conversation={conversation({ status: "STAFF_ACTIVE", assignedStaffUserId: "staff-1" })} messages={[]} isMessagesLoading={false} messagesError={null} canManage staffUsers={[{ id: "staff-1", name: "منى" }]} pendingAction={null} actionError={null} t={t} {...handlers} />)

    fireEvent.change(screen.getByLabelText("الرد"), { target: { value: "أهلاً بك" } })
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }))
    expect(handlers.onReply).toHaveBeenCalledWith("أهلاً بك")
    expect(screen.getByRole("button", { name: "إعادة للمساعد" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "إغلاق المحادثة" })).toBeInTheDocument()
    expect(screen.getByLabelText("الموظف المسؤول")).toBeInTheDocument()
  })

  it("shows AI-active and closed conversations as read-only", () => {
    const { rerender } = render(<ConversationDetail conversation={conversation({ status: "AI_ACTIVE" })} messages={[]} isMessagesLoading={false} messagesError={null} canManage={false} staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.getByText("يدير المساعد هذه المحادثة حالياً")).toBeInTheDocument()
    expect(screen.queryByLabelText("الرد")).not.toBeInTheDocument()

    rerender(<ConversationDetail conversation={conversation({ status: "CLOSED" })} messages={[]} isMessagesLoading={false} messagesError={null} canManage={false} staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.getByText("هذه المحادثة مغلقة")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "إغلاق المحادثة" })).not.toBeInTheDocument()
  })
})
