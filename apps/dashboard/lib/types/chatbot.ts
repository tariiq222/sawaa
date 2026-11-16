/**
 * Chatbot Types — Sawaa Dashboard
 *
 * Matches the backend Prisma schema + API response shapes
 * for sessions, messages, knowledge base, config, and analytics.
 */

import type { components } from "@/lib/types/api.generated"
import type { PaginatedQuery } from "./common"

type Schemas = components["schemas"]

/* ─── Enums ─── */

export type ChatRole = "user" | "assistant" | "system" | "staff"

export type SessionLanguage = "ar" | "en"

export type KbDocumentStatus = "PENDING" | "EMBEDDED" | "FAILED"

export type KbSourceType = "manual" | "url" | "file"

/* ─── Chat Session (derived from the OpenAPI snapshot) ─── */

/**
 * The legacy dashboard chat routes
 * (`/dashboard/comms/chat/conversations/*`) are documented in the snapshot as
 * `StaffChat*` schemas. The dashboard names stay the same, but every shape is
 * now read from the committed contract:
 *  - the list row is a derived projection (`ListConversationsHandler`);
 *  - the detail row is a different projection (`GetConversationHandler`);
 *  - `endChatSession` returns the raw `ChatConversation` row, and
 *    `sendStaffMessage` the raw `CommsChatMessage` row.
 */

export type ChatSessionUser = Schemas["StaffChatConversationUserDto"]

/** `GET /dashboard/comms/chat/conversations` row. */
export type ChatSession = Schemas["StaffChatConversationListRowDto"]

/** `GET /dashboard/comms/chat/conversations/:id`. */
export type ChatSessionDetail = Schemas["StaffChatConversationDetailDto"]

/** One message embedded in the detail projection. */
export type ChatMessage = Schemas["StaffChatConversationMessageDto"]

/** `GET /dashboard/comms/chat/conversations` response envelope. */
export type ChatSessionListResponse = Schemas["StaffChatConversationListResponseDto"]

/** `PATCH /dashboard/comms/chat/conversations/:id/close` raw conversation row. */
export type EndChatSessionResult = Schemas["StaffChatConversationRecordDto"]

/** `POST /dashboard/comms/chat/conversations/:id/messages` raw message row. */
export type SendStaffMessageResult = Schemas["StaffChatMessageRecordDto"]

/* ─── Action Card (from handleMessage) ─── */

export type ActionCardType =
  | "booking_created"
  | "bookings_list"
  | "services_list"
  | "employees_list"
  | "slots_list"
  | "cancellation_requested"
  | "handoff"

export interface ActionCard {
  type: ActionCardType
  payload: unknown
}

export interface HandleMessageResult {
  message: string
  intent?: string
  toolName?: string
  actionCard?: ActionCard
}

/* ─── Knowledge Base ─── */

export interface KnowledgeBaseEntry {
  id: string
  title: string
  sourceType: KbSourceType
  sourceRef: string | null
  status: KbDocumentStatus
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

/** Backend `ManageKnowledgeBaseHandler.listDocuments` returns `{ data, meta }`. */
export interface KnowledgeBaseResponse {
  data: KnowledgeBaseEntry[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/* ─── Chatbot Config ─── */

export interface ChatbotConfig {
  id: string
  systemPromptAr: string | null
  systemPromptEn: string | null
  greetingAr: string | null
  greetingEn: string | null
  escalateToHumanAt: number | null
  settings: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface QuickReply {
  label_ar: string
  label_en: string
  action: string
}

/* ─── Query Params ─── */

export interface ChatSessionListQuery extends PaginatedQuery {
  handedOff?: boolean
  language?: SessionLanguage
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface KnowledgeBaseQuery extends PaginatedQuery {
  status?: KbDocumentStatus
}

export interface AnalyticsQuery {
  from?: string
  to?: string
}

/* ─── Mutation Payloads ─── */

export interface CreateSessionPayload {
  language?: SessionLanguage
}

export interface SendMessagePayload {
  content: string
}

export interface UpdateKbEntryPayload {
  title?: string
  metadata?: Record<string, unknown>
}

export interface ConfigItemPayload {
  key: string
  value: unknown
  category: string
}

export interface UpdateChatbotConfigPayload {
  configs: ConfigItemPayload[]
}

export interface UpsertChatbotConfigPayload {
  systemPromptAr?: string
  systemPromptEn?: string
  greetingAr?: string
  greetingEn?: string
  escalateToHumanAt?: number
  settings?: Record<string, unknown>
}

/* ─── Create Session Response ─── */

export interface CreateSessionResponse {
  session: ChatSession
  welcomeMessage: string
  quickReplies: QuickReply[]
  botConfig: {
    bot_name: string
    bot_avatar_url: string | null
    tone: string
  }
}
