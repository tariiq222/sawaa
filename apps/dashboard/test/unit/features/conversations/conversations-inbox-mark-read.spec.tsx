import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Conversation } from "@/lib/types/conversations"

const mocks = vi.hoisted(() => {
  const conversation: Conversation = {
    id: "conversation-1",
    clientId: null,
    isAiChat: true,
    status: "STAFF_ACTIVE",
    guestName: "سارة",
    guestPhone: "+966501234567",
    language: "ar",
    assignedStaffUserId: "staff-1",
    handoffRequestedAt: null,
    staffClaimedAt: "2026-08-14T06:00:00.000Z",
    closedAt: null,
    staffUnreadCount: 1,
    clientUnreadCount: 0,
    lastMessageAt: "2026-08-14T06:00:00.000Z",
    createdAt: "2026-08-14T05:00:00.000Z",
    updatedAt: "2026-08-14T06:00:00.000Z",
  }
  return {
    conversation,
    detailData: conversation,
    markRead: { isPending: false, mutate: vi.fn() },
    t: (key: string) => key,
  }
})

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: mocks.t }) }))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "staff-1" }, canDo: () => false }),
}))
vi.mock("@/hooks/use-conversations", () => ({
  useConversations: () => ({
    data: { pages: [{ data: [mocks.conversation], meta: { hasMore: false, nextCursor: null, limit: 50 } }] },
    isLoading: false, error: null, hasNextPage: false, isFetchingNextPage: false,
    refetch: vi.fn(), fetchNextPage: vi.fn(),
  }),
  useConversation: () => ({ data: mocks.detailData, dataUpdatedAt: Date.parse(mocks.detailData.updatedAt), isLoading: false, error: null }),
  useConversationMessages: () => ({
    data: { pages: [{ data: [{
      id: "message-1", conversationId: "conversation-1", senderType: "VISITOR", body: "مرحباً",
      kind: "TEXT", clientMessageId: "client-1", createdAt: "2026-08-14T06:00:00.000Z",
    }], meta: { hasMore: false, nextCursor: null, limit: 100 } }] },
    isLoading: false, error: null, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(),
  }),
  useAssignableConversationStaff: () => ({ data: [] }),
}))
vi.mock("@/hooks/use-conversation-mutations", () => ({
  useConversationMutations: () => ({
    claim: { isPending: false, mutateAsync: vi.fn() },
    reply: { isPending: false, mutateAsync: vi.fn() },
    assign: { isPending: false, mutateAsync: vi.fn() },
    release: { isPending: false, mutateAsync: vi.fn() },
    close: { isPending: false, mutateAsync: vi.fn() },
    markRead: mocks.markRead,
  }),
}))

import { ConversationsInbox } from "@/components/features/conversations/conversations-inbox"

describe("ConversationsInbox mark-read recovery", () => {
  beforeEach(() => {
    mocks.detailData = mocks.conversation
    mocks.markRead.mutate.mockReset()
    mocks.markRead.mutate.mockImplementation((_input, options) => options?.onError?.(new Error("network")))
  })

  it("surfaces a mark-read failure and retries after the next conversation refresh", async () => {
    mocks.markRead.mutate
      .mockImplementationOnce((_input, options) => options?.onError?.(new Error("network")))
      .mockImplementationOnce((_input, options) => options?.onSuccess?.({ markedReadCount: 1, readAt: "2026-08-14T06:00:08.000Z" }))
    const { rerender } = render(<ConversationsInbox />)
    await waitFor(() => expect(mocks.markRead.mutate).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("alert")).toHaveTextContent("conversations.error.markRead")

    mocks.detailData = { ...mocks.conversation, updatedAt: "2026-08-14T06:00:08.000Z" }
    rerender(<ConversationsInbox />)

    await waitFor(() => expect(mocks.markRead.mutate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
  })
})
