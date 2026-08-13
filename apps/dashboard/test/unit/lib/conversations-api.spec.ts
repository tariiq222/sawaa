import { beforeEach, describe, expect, it, vi } from "vitest"

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get, post },
  ApiError: class ApiError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message)
    }
  },
}))

import {
  assignConversation,
  claimConversation,
  closeConversation,
  fetchConversation,
  fetchConversationMessages,
  fetchConversations,
  isConversationClaimConflict,
  markConversationRead,
  releaseConversation,
  replyToConversation,
} from "@/lib/api/conversations"

describe("conversations API", () => {
  beforeEach(() => vi.clearAllMocks())

  it("forwards inbox filters to the dashboard endpoint", async () => {
    get.mockResolvedValue({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } })
    const filters = {
      status: "WAITING_FOR_STAFF" as const,
      assigned: "unassigned" as const,
      unreadOnly: true,
      search: "سارة",
      cursor: "conversation-1",
      limit: 25,
    }

    await fetchConversations(filters)

    expect(get).toHaveBeenCalledWith("/dashboard/conversations", filters)
  })

  it("uses the conversation detail and messages endpoints", async () => {
    get.mockResolvedValue({})

    await fetchConversation("conversation-1")
    await fetchConversationMessages("conversation-1", { cursor: "message-1", limit: 50 })

    expect(get).toHaveBeenNthCalledWith(1, "/dashboard/conversations/conversation-1")
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/dashboard/conversations/conversation-1/messages",
      { cursor: "message-1", limit: 50 },
    )
  })

  it("posts every supported staff action to its dedicated endpoint", async () => {
    post.mockResolvedValue({})

    await claimConversation("conversation-1")
    await replyToConversation("conversation-1", { body: "مرحباً", clientMessageId: "reply-1" })
    await assignConversation("conversation-1", "staff-1")
    await releaseConversation("conversation-1")
    await closeConversation("conversation-1")
    await markConversationRead("conversation-1", { throughMessageId: "message-1" })

    expect(post.mock.calls).toEqual([
      ["/dashboard/conversations/conversation-1/claim"],
      ["/dashboard/conversations/conversation-1/messages", { body: "مرحباً", clientMessageId: "reply-1" }],
      ["/dashboard/conversations/conversation-1/assign", { targetStaffUserId: "staff-1" }],
      ["/dashboard/conversations/conversation-1/release"],
      ["/dashboard/conversations/conversation-1/close"],
      ["/dashboard/conversations/conversation-1/read", { throughMessageId: "message-1" }],
    ])
  })

  it("recognizes only HTTP 409 as a claim conflict", () => {
    expect(isConversationClaimConflict({ status: 409 })).toBe(true)
    expect(isConversationClaimConflict({ status: 403 })).toBe(false)
    expect(isConversationClaimConflict(new Error("conflict"))).toBe(false)
  })
})
