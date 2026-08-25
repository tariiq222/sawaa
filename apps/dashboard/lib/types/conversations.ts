export type ConversationStatus =
  | "OPEN"
  | "AI_ACTIVE"
  | "WAITING_FOR_STAFF"
  | "STAFF_ACTIVE"
  | "CLOSED"

export type ConversationAssignmentFilter = "all" | "me" | "unassigned"

export type ConversationSenderType =
  | "CLIENT"
  | "EMPLOYEE"
  | "VISITOR"
  | "AI"
  | "STAFF"
  | "SYSTEM"

export type ConversationMessageKind =
  | "TEXT"
  | "ACTION_CARD"
  | "OPERATION_RESULT"
  | "SYSTEM_EVENT"

export type HandoffSummary = {
  category: "USER_REQUESTED" | "COMPLAINT" | "FINANCIAL_EXCEPTION" | "UNAVAILABLE_APPOINTMENT" | "OTHER"
  requestSummary: string
  desiredOutcome: string
  serviceId?: string
  practitionerId?: string
  acceptableAlternatives?: string[]
}

export interface Conversation {
  id: string
  clientId: string | null
  isAiChat: boolean
  status: ConversationStatus
  guestName: string | null
  guestPhone: string | null
  language: string
  assignedStaffUserId: string | null
  handoffRequestedAt: string | null
  staffClaimedAt: string | null
  closedAt: string | null
  staffUnreadCount: number
  clientUnreadCount: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
  handoffSummary?: HandoffSummary | null
}

export interface ConversationMessage {
  id: string
  conversationId: string
  senderType: ConversationSenderType
  body: string
  kind: ConversationMessageKind
  clientMessageId: string | null
  createdAt: string
}

export interface CursorMeta {
  limit: number
  nextCursor: string | null
  hasMore: boolean
}

export interface ConversationListResponse {
  data: Conversation[]
  meta: CursorMeta
}

export interface ConversationMessagesResponse {
  data: ConversationMessage[]
  meta: CursorMeta
}

export interface ConversationFilters {
  status?: ConversationStatus
  unreadOnly?: boolean
  assigned?: ConversationAssignmentFilter
  search?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export interface ConversationMessageFilters {
  cursor?: string
  limit?: number
}

export interface ReplyConversationPayload {
  body: string
  clientMessageId: string
}

export interface MarkConversationReadPayload {
  throughMessageId?: string
  throughSequence?: string
}

export interface MarkConversationReadResponse {
  markedReadCount: number
  readAt: string
}
