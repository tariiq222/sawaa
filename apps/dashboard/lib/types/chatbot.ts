/**
 * Chatbot Types — Sawaa Dashboard
 *
 * Matches the backend Prisma schema + API response shapes
 * for sessions, messages, knowledge base, config, and analytics.
 */

import type { PaginatedQuery } from "./common"

/* ─── Enums ─── */

export type ChatRole = "user" | "assistant" | "system" | "staff"

export type SessionLanguage = "ar" | "en"

export type HandoffType = "live_chat" | "contact_number"

export type KbDocumentStatus = "PENDING" | "EMBEDDED" | "FAILED"

export type KbSourceType = "manual" | "url" | "file"

/* ─── Chat Session ─── */

export interface ChatSessionUser {
  id: string
  firstName: string
  lastName: string
}

export interface ChatSession {
  id: string
  clientId: string
  employeeId: string | null
  startedAt: string
  endedAt: string | null
  handedOff: boolean
  handoffType?: HandoffType | null
  language?: SessionLanguage | null
  lastMessageAt: string | null
  user: ChatSessionUser
  _count: { messages: number }
}

export interface ChatSessionDetail {
  id: string
  clientId: string
  employeeId: string | null
  startedAt: string
  endedAt: string | null
  handedOff: boolean
  handoffType?: HandoffType | null
  language?: SessionLanguage | null
  lastMessageAt: string | null
  user: ChatSessionUser
  messages: ChatMessage[]
}

/* ─── Chat Message ─── */

export interface ChatMessage {
  id: string
  conversationId: string
  role: ChatRole
  content: string
  createdAt: string
}

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
