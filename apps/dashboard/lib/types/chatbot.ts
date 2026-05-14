/**
 * Chatbot Types — Deqah Dashboard
 *
 * Matches the backend Prisma schema + API response shapes
 * for sessions, messages, knowledge base, config, and analytics.
 */

import type { PaginatedQuery } from "./common"

/* ─── Enums ─── */

export type ChatRole = "user" | "assistant" | "system" | "staff"

export type SessionLanguage = "ar" | "en"

export type HandoffType = "live_chat" | "contact_number"

export type KbFileStatus = "pending" | "processing" | "completed" | "failed"

export type KbSource = "manual" | "auto_sync" | "file_upload"

/* ─── Chat Session ─── */

export interface ChatSessionUser {
  id: string
  firstName: string
  lastName: string
}

export interface ChatSession {
  id: string
  userId: string
  startedAt: string
  endedAt: string | null
  handedOff: boolean
  handoffType: HandoffType | null
  language: SessionLanguage | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  user: ChatSessionUser
  _count: { messages: number }
}

export interface ChatSessionDetail {
  id: string
  userId: string
  startedAt: string
  endedAt: string | null
  handedOff: boolean
  handoffType: HandoffType | null
  language: SessionLanguage | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  user: ChatSessionUser
  messages: ChatMessage[]
}

/* ─── Chat Message ─── */

export interface ChatMessage {
  id: string
  sessionId: string
  role: ChatRole
  content: string
  functionCall: Record<string, unknown> | null
  intent: string | null
  toolName: string | null
  tokenCount: number | null
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
  content: string
  category: string | null
  source: KbSource | null
  fileId: string | null
  chunkIndex: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/* ─── Knowledge Base File ─── */

export interface KnowledgeBaseFile {
  id: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  chunksCount: number
  status: KbFileStatus
  error: string | null
  uploadedBy: string
  createdAt: string
  updatedAt: string
  user: { firstName: string; lastName: string }
}

/* ─── Chatbot Config ─── */

export interface ChatbotConfigEntry {
  id: string
  key: string
  value: unknown
  category: string
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
  source?: KbSource
  category?: string
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

export interface CreateKbEntryPayload {
  title: string
  content: string
  category?: string
}

export interface UpdateKbEntryPayload {
  title?: string
  content?: string
  category?: string
  isActive?: boolean
}

export interface ConfigItemPayload {
  key: string
  value: unknown
  category: string
}

export interface UpdateChatbotConfigPayload {
  configs: ConfigItemPayload[]
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
