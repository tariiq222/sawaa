/**
 * Contract test for the dashboard reception-chat and legacy chat types (MNT-08).
 *
 * `lib/types/conversations.ts` and the chat-session part of
 * `lib/types/chatbot.ts` derive every response/query shape from the committed
 * OpenAPI snapshot. These assertions run at type-check time
 * (`pnpm --filter dashboard typecheck`) and at test time, and fail when the wire
 * shape moves underneath the dashboard or when a derivation is replaced by a
 * hand-written copy.
 */
import { describe, expect, it } from "vitest"
import type { components, paths } from "@/lib/types/api.generated"
import type {
  Conversation,
  ConversationAssignmentFilter,
  ConversationFilters,
  ConversationListResponse,
  ConversationMessage,
  ConversationMessageFilters,
  ConversationMessageKind,
  ConversationMessagesResponse,
  ConversationSenderType,
  ConversationStatus,
  CursorMeta,
  HandoffSummary,
  MarkConversationReadPayload,
  MarkConversationReadResponse,
  ReplyConversationPayload,
} from "@/lib/types/conversations"
import type {
  ChatMessage,
  ChatSession,
  ChatSessionDetail,
  ChatSessionListResponse,
  ChatSessionUser,
  EndChatSessionResult,
  SendStaffMessageResult,
} from "@/lib/types/chatbot"

type Schemas = components["schemas"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/* ─── Reception inbox: entities are the wire shapes, unchanged ─── */

type _ConversationIsWire = Expect<Equal<Conversation, Schemas["ConversationResponseDto"]>>
type _MessageIsWire = Expect<Equal<ConversationMessage, Schemas["ConversationMessageResponseDto"]>>
type _CursorMetaIsWire = Expect<Equal<CursorMeta, Schemas["ConversationCursorMetaDto"]>>
type _ListIsWire = Expect<Equal<ConversationListResponse, Schemas["ConversationInboxResponseDto"]>>
type _MessagesIsWire = Expect<Equal<ConversationMessagesResponse, Schemas["ConversationMessagesResponseDto"]>>
type _ReadIsWire = Expect<Equal<MarkConversationReadResponse, Schemas["ConversationReadResponseDto"]>>
type _HandoffIsWire = Expect<Equal<HandoffSummary, NonNullable<Schemas["ConversationResponseDto"]["handoffSummary"]>>>

/** The lifecycle/author/kind vocabularies are the snapshot enums, not local copies. */
type _StatusIsWire = Expect<Equal<ConversationStatus, Schemas["ConversationResponseDto"]["status"]>>
type _StatusValues = Expect<
  Equal<ConversationStatus, "OPEN" | "AI_ACTIVE" | "WAITING_FOR_STAFF" | "STAFF_ACTIVE" | "CLOSED">
>
type _SenderIsWire = Expect<Equal<ConversationSenderType, Schemas["ConversationMessageResponseDto"]["senderType"]>>
type _KindIsWire = Expect<Equal<ConversationMessageKind, Schemas["ConversationMessageResponseDto"]["kind"]>>
type _AssignmentIsQueryValue = Expect<Equal<ConversationAssignmentFilter, NonNullable<ConversationFilters["assigned"]>>>

/* ─── Reception inbox: request side derives from the operation parameters ─── */

type InboxQueryWire = NonNullable<paths["/api/v1/dashboard/conversations"]["get"]["parameters"]["query"]>
type MessagesQueryWire = NonNullable<
  paths["/api/v1/dashboard/conversations/{conversationId}/messages"]["get"]["parameters"]["query"]
>
type _InboxQueryIsWire = Expect<Equal<ConversationFilters, InboxQueryWire>>
type _MessagesQueryIsWire = Expect<Equal<ConversationMessageFilters, MessagesQueryWire>>
type _ReplyBodyIsWire = Expect<Equal<ReplyConversationPayload, Schemas["SendChatMessageDto"]>>
type _ReadBodyIsWire = Expect<Equal<MarkConversationReadPayload, Schemas["MarkConversationReadDto"]>>

/**
 * Known deferred gap, pinned so it cannot silently become "documented": the
 * legacy dashboard chat list still offers `handedOff`/`language`/`fromDate`/
 * `toDate`/`search` filters that the backend DTO does not declare (and the
 * global `forbidNonWhitelisted` pipe would reject if sent). Request params were
 * left byte-identical, so `ChatSessionListQuery` stays local for now.
 */
type CommsListQueryWire = NonNullable<
  paths["/api/v1/dashboard/comms/chat/conversations"]["get"]["parameters"]["query"]
>
type _CommsListQueryIsDocumented = Expect<Equal<keyof CommsListQueryWire, "page" | "limit" | "clientId" | "employeeId">>
type _HandedOffIsUndocumented = Expect<
  Equal<"handedOff" extends keyof CommsListQueryWire ? true : false, false>
>

/** Nullability that the wire really carries. */
type _GuestNameIsNullable = Expect<Equal<Conversation["guestName"], string | null>>
type _AssignedStaffIsNullable = Expect<Equal<Conversation["assignedStaffUserId"], string | null>>
type _UnreadCountsAreIntegers = Expect<Equal<Conversation["staffUnreadCount"], number>>
type _ReadCountIsInteger = Expect<Equal<MarkConversationReadResponse["markedReadCount"], number>>
type _MetadataIsOptional = Expect<Equal<ConversationMessage["metadata"], Schemas["ConversationMessageResponseDto"]["metadata"]>>

/* ─── Legacy chat sessions: derived from the StaffChat* schemas ─── */

type _ChatSessionIsWire = Expect<Equal<ChatSession, Schemas["StaffChatConversationListRowDto"]>>
type _ChatSessionDetailIsWire = Expect<Equal<ChatSessionDetail, Schemas["StaffChatConversationDetailDto"]>>
type _ChatMessageIsWire = Expect<Equal<ChatMessage, Schemas["StaffChatConversationMessageDto"]>>
type _ChatSessionUserIsWire = Expect<Equal<ChatSessionUser, Schemas["StaffChatConversationUserDto"]>>
type _ChatListIsWire = Expect<Equal<ChatSessionListResponse, Schemas["StaffChatConversationListResponseDto"]>>
type _EndSessionIsRawRecord = Expect<Equal<EndChatSessionResult, Schemas["StaffChatConversationRecordDto"]>>
type _SendMessageIsRawRecord = Expect<Equal<SendStaffMessageResult, Schemas["StaffChatMessageRecordDto"]>>

/** The documented role vocabulary on the detail route. */
type _ChatRoleIsWire = Expect<Equal<ChatMessage["role"], "user" | "staff" | "assistant">>
/** Two different projections: the list row has `_count`, the detail has `messages`. */
type _ListHasCount = Expect<Equal<"_count" extends keyof ChatSession ? true : false, true>>
type _ListHasNoMessages = Expect<Equal<"messages" extends keyof ChatSession ? true : false, false>>
type _DetailHasMessages = Expect<Equal<"messages" extends keyof ChatSessionDetail ? true : false, true>>
type _DetailHasNoCount = Expect<Equal<"_count" extends keyof ChatSessionDetail ? true : false, false>>

/* ─── Runtime smoke: the types line up with a real wire row ─── */

const wireConversation: Schemas["ConversationResponseDto"] = {
  id: "00000000-4000-4000-a000-000000000001",
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
  handoffSummary: null,
}

const dashboardConversation: Conversation = wireConversation

describe("conversation type contract", () => {
  it("keeps the reception inbox row aligned with the OpenAPI snapshot", () => {
    expect(dashboardConversation.status).toBe("WAITING_FOR_STAFF")
    expect(dashboardConversation.staffUnreadCount).toBe(3)
    expect(dashboardConversation.handoffSummary).toBeNull()
    expect(dashboardConversation.guestPhone).toBe("+966501234567")
  })

  it("documents the safe hand-off projection separately from the raw context", () => {
    const summary: HandoffSummary = {
      category: "COMPLAINT",
      requestSummary: "طلب التحدث مع موظفة",
      desiredOutcome: "تعديل الموعد",
    }
    expect(summary.category).toBe("COMPLAINT")
    expect("customerContext" in wireConversation).toBe(false)
  })
})
