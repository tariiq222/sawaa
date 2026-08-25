import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Conversation } from "@/lib/types/conversations"
import { ConversationList } from "@/components/features/conversations/conversation-list"
import { ConversationDetail } from "@/components/features/conversations/conversation-detail"
import { ConversationComposer } from "@/components/features/conversations/conversation-composer"

const labels: Record<string, string> = {
  "conversations.loading": "جارٍ تحميل المحادثات",
  "conversations.error": "تعذّر تحميل المحادثات",
  "conversations.empty.title": "لا توجد محادثات",
  "conversations.empty.description": "ستظهر المحادثات هنا",
  "conversations.search": "ابحث بالاسم أو الجوال",
  "conversations.filter.all": "الكل",
  "conversations.filter.unread": "غير مقروءة",
  "conversations.filter.assignment": "الإسناد",
  "conversations.filter.assignment.all": "كل الإسنادات",
  "conversations.filter.assignment.me": "مسندة لي",
  "conversations.filter.assignment.unassigned": "غير مسندة",
  "conversations.filter.from": "من تاريخ",
  "conversations.filter.to": "إلى تاريخ",
  "conversations.loadMore": "تحميل المزيد",
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
  "conversations.detail.loading": "جارٍ تحميل تفاصيل المحادثة",
  "conversations.detail.error": "تعذّر تحميل تفاصيل المحادثة",
  "conversations.detail.loadOlder": "تحميل رسائل أقدم",
  "conversations.detail.handoffSummary": "ملخص التحويل",
  "conversations.detail.handoffCategory": "التصنيف",
  "conversations.detail.requestSummary": "الطلب",
  "conversations.detail.desiredOutcome": "النتيجة المطلوبة",
  "conversations.detail.acceptableAlternatives": "البدائل المقبولة",
  "conversations.detail.handoffCategory.COMPLAINT": "شكوى",
  "conversations.composer.label": "الرد",
  "conversations.composer.placeholder": "اكتب ردك",
  "conversations.composer.send": "إرسال",
}

const t = (key: string) => labels[key] ?? key
const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: "conversation-1",
  clientId: null,
  isAiChat: true,
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
        locale="ar"
        hasNextPage={false}
        isFetchingNextPage={false}
        t={t}
        onFiltersChange={vi.fn()}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
        onLoadMore={vi.fn()}
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
        locale="ar"
        hasNextPage={false}
        isFetchingNextPage={false}
        t={t}
        onFiltersChange={vi.fn()}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: `سارة ${label}` })).toBeInTheDocument()
  })

  it("covers loading, error, and empty states", () => {
    const props = {
      conversations: [], selectedId: null, filters: {}, t,
      hasNextPage: false, isFetchingNextPage: false,
      locale: "ar" as const,
      onFiltersChange: vi.fn(), onSelect: vi.fn(), onRetry: vi.fn(), onLoadMore: vi.fn(),
    }
    const { rerender } = render(<ConversationList {...props} isLoading error={null} />)
    expect(screen.getByLabelText("جارٍ تحميل المحادثات")).toBeInTheDocument()

    rerender(<ConversationList {...props} isLoading={false} error={new Error("network")} />)
    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تحميل المحادثات")

    rerender(<ConversationList {...props} isLoading={false} error={null} />)
    expect(screen.getByText("لا توجد محادثات")).toBeInTheDocument()
  })

  it("offers assignment filters to administrators and loads additional cursor pages", () => {
    const onFiltersChange = vi.fn()
    const onLoadMore = vi.fn()
    render(<ConversationList conversations={[conversation()]} selectedId={null} filters={{ assigned: "all" }} isLoading={false} error={null} locale="ar" hasNextPage isFetchingNextPage={false} t={t} onFiltersChange={onFiltersChange} onSelect={vi.fn()} onRetry={vi.fn()} onLoadMore={onLoadMore} />)

    fireEvent.click(screen.getByRole("button", { name: "مسندة لي" }))
    fireEvent.click(screen.getByRole("button", { name: "تحميل المزيد" }))

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ assigned: "me" }))
    expect(onLoadMore).toHaveBeenCalled()
  })

  it("offers assignment and inclusive date filters to reception staff", () => {
    const onFiltersChange = vi.fn()
    render(<ConversationList conversations={[]} selectedId={null} filters={{}} isLoading={false} error={null} locale="ar" hasNextPage={false} isFetchingNextPage={false} t={t} onFiltersChange={onFiltersChange} onSelect={vi.fn()} onRetry={vi.fn()} onLoadMore={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "مسندة لي" }))
    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-08-01" } })
    fireEvent.change(screen.getByLabelText("إلى تاريخ"), { target: { value: "2026-08-31" } })

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ assigned: "me" }))
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ from: "2026-08-01T00:00:00.000Z" }))
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ to: "2026-08-31T23:59:59.999Z" }))
  })

  it("formats the latest-message time with the selected locale", () => {
    const shared = { conversations: [conversation()], selectedId: null, filters: {}, isLoading: false, error: null, hasNextPage: false, isFetchingNextPage: false, t, onFiltersChange: vi.fn(), onSelect: vi.fn(), onRetry: vi.fn(), onLoadMore: vi.fn() }
    const { container, rerender } = render(<ConversationList {...shared} locale="ar" />)
    const arabicTime = container.querySelector("time")?.textContent

    rerender(<ConversationList {...shared} locale="en" />)
    expect(container.querySelector("time")?.textContent).not.toBe(arabicTime)
  })
})

describe("ConversationDetail handoff summary", () => {
  it("renders the safe projected summary before the transcript", () => {
    render(<ConversationDetail conversation={conversation({ handoffSummary: {
      category: "COMPLAINT", requestSummary: "<شكوى>", desiredOutcome: "متابعة", acceptableAlternatives: ["رسالة"],
    } })} isDetailLoading={false} detailError={null} messages={[{ id: "m1", conversationId: "conversation-1", senderType: "CLIENT", body: "نص السجل", kind: "TEXT", clientMessageId: null, createdAt: "2026-08-14T06:00:00.000Z" }]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage={false} canUpdate={false} staffUsers={[]} pendingAction={null} actionError={null} t={t} onClaim={vi.fn()} onReply={vi.fn()} onAssign={vi.fn()} onRelease={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole("region", { name: "ملخص التحويل" })).toBeInTheDocument()
    expect(screen.getByText("<شكوى>")).toBeInTheDocument()
    expect(screen.getByText("نص السجل")).toBeInTheDocument()
  })
})

describe("ConversationComposer", () => {
  it("keeps text typed after an in-flight submission succeeds", async () => {
    let resolveSend!: (sent: boolean) => void
    const onSend = vi.fn(() => new Promise<boolean>((resolve) => { resolveSend = resolve }))
    const { rerender } = render(<ConversationComposer isPending={false} t={t} onSend={onSend} />)
    const composer = screen.getByLabelText("الرد")
    fireEvent.change(composer, { target: { value: "المسودة المرسلة" } })
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }))

    rerender(<ConversationComposer isPending t={t} onSend={onSend} />)
    fireEvent.change(composer, { target: { value: "مسودة جديدة" } })
    await act(async () => {
      resolveSend(true)
      await Promise.resolve()
    })

    expect(composer).toHaveValue("مسودة جديدة")
  })
})

describe("ConversationDetail", () => {
  const handlers = {
    onClaim: vi.fn(), onReply: vi.fn().mockResolvedValue(true), onAssign: vi.fn(), onRelease: vi.fn(), onClose: vi.fn(),
  }

  it("offers claim for a waiting conversation and hides the composer", () => {
    render(<ConversationDetail conversation={conversation()} isDetailLoading={false} detailError={null} messages={[]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage={false} canUpdate staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.getByRole("button", { name: "استلام المحادثة" })).toBeInTheDocument()
    expect(screen.queryByLabelText("الرد")).not.toBeInTheDocument()
  })

  it("allows reply, release, close, and assignment for an active managed conversation", async () => {
    render(<ConversationDetail conversation={conversation({ status: "STAFF_ACTIVE", assignedStaffUserId: "staff-1", isAiChat: true })} isDetailLoading={false} detailError={null} messages={[]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage canUpdate staffUsers={[{ id: "staff-1", name: "منى" }]} pendingAction={null} actionError={null} t={t} {...handlers} />)

    fireEvent.change(screen.getByLabelText("الرد"), { target: { value: "أهلاً بك" } })
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }))
    await waitFor(() => expect(handlers.onReply).toHaveBeenCalledWith("أهلاً بك"))
    expect(screen.getByRole("button", { name: "إعادة للمساعد" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "إغلاق المحادثة" })).toBeInTheDocument()
    expect(screen.getByLabelText("الموظف المسؤول")).toBeInTheDocument()
  })

  it("never offers release for a legacy non-AI staff conversation", () => {
    render(<ConversationDetail conversation={conversation({ status: "STAFF_ACTIVE", assignedStaffUserId: "staff-1", isAiChat: false })} isDetailLoading={false} detailError={null} messages={[]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage canUpdate staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.queryByRole("button", { name: "إعادة للمساعد" })).not.toBeInTheDocument()
  })

  it("preserves a reply draft on failure and clears it only after success", async () => {
    const onReply = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    render(<ConversationDetail conversation={conversation({ status: "STAFF_ACTIVE", assignedStaffUserId: "staff-1" })} isDetailLoading={false} detailError={null} messages={[]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage={false} canUpdate staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} onReply={onReply} />)
    const composer = screen.getByLabelText("الرد")
    fireEvent.change(composer, { target: { value: "رد مهم" } })
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }))
    await waitFor(() => expect(onReply).toHaveBeenCalledTimes(1))
    expect(composer).toHaveValue("رد مهم")
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }))
    await waitFor(() => expect(composer).toHaveValue(""))
  })

  it("does not carry a draft when switching conversations", () => {
    const base = { isDetailLoading: false, detailError: null, messages: [], isMessagesLoading: false, messagesError: null, hasOlderMessages: false, isLoadingOlderMessages: false, onLoadOlderMessages: vi.fn(), canManage: false, canUpdate: true, staffUsers: [], pendingAction: null as null, actionError: null, t, ...handlers }
    const { rerender } = render(<ConversationDetail {...base} conversation={conversation({ id: "conversation-a", status: "STAFF_ACTIVE" })} />)
    fireEvent.change(screen.getByLabelText("الرد"), { target: { value: "مسودة أ" } })

    rerender(<ConversationDetail {...base} conversation={conversation({ id: "conversation-b", status: "STAFF_ACTIVE" })} />)

    expect(screen.getByLabelText("الرد")).toHaveValue("")
  })

  it("renders legacy EMPLOYEE messages as outgoing staff messages", () => {
    render(<ConversationDetail conversation={conversation({ status: "CLOSED" })} isDetailLoading={false} detailError={null} messages={[{ id: "message-1", conversationId: "conversation-1", senderType: "EMPLOYEE", body: "رد قديم", kind: "TEXT", clientMessageId: null, createdAt: "2026-08-14T06:00:00.000Z" }]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage={false} canUpdate staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.getByText("رد قديم").closest("article")).toHaveClass("ms-auto")
  })

  it("does not expose update actions to a read-only user", () => {
    render(<ConversationDetail conversation={conversation()} isDetailLoading={false} detailError={null} messages={[]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage={false} canUpdate={false} staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.queryByRole("button", { name: "استلام المحادثة" })).not.toBeInTheDocument()
  })

  it("renders explicit detail loading and error states without list fallback", () => {
    const base = { messages: [], isMessagesLoading: false, messagesError: null, hasOlderMessages: false, isLoadingOlderMessages: false, onLoadOlderMessages: vi.fn(), canManage: false, canUpdate: true, staffUsers: [], pendingAction: null as null, actionError: null, t, ...handlers }
    const { rerender } = render(<ConversationDetail {...base} conversation={null} isDetailLoading detailError={null} />)
    expect(screen.getByLabelText("جارٍ تحميل تفاصيل المحادثة")).toBeInTheDocument()
    rerender(<ConversationDetail {...base} conversation={null} isDetailLoading={false} detailError={new Error("network")} />)
    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تحميل تفاصيل المحادثة")
  })

  it("shows AI-active and closed conversations as read-only", () => {
    const { rerender } = render(<ConversationDetail conversation={conversation({ status: "AI_ACTIVE" })} isDetailLoading={false} detailError={null} messages={[]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage={false} canUpdate staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.getByText("يدير المساعد هذه المحادثة حالياً")).toBeInTheDocument()
    expect(screen.queryByLabelText("الرد")).not.toBeInTheDocument()

    rerender(<ConversationDetail conversation={conversation({ status: "CLOSED" })} isDetailLoading={false} detailError={null} messages={[]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage={false} canUpdate staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.getByText("هذه المحادثة مغلقة")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "إغلاق المحادثة" })).not.toBeInTheDocument()
  })

  it("allows an administrator to close an AI-active conversation", () => {
    render(<ConversationDetail conversation={conversation({ status: "AI_ACTIVE" })} isDetailLoading={false} detailError={null} messages={[]} isMessagesLoading={false} messagesError={null} hasOlderMessages={false} isLoadingOlderMessages={false} onLoadOlderMessages={vi.fn()} canManage canUpdate staffUsers={[]} pendingAction={null} actionError={null} t={t} {...handlers} />)
    expect(screen.getByRole("button", { name: "إغلاق المحادثة" })).toBeInTheDocument()
  })
})
