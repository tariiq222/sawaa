// whatsapp — WhatsApp AI agent types (dashboard).

export type WhatsappProviderName = "META_CLOUD" | "EVOLUTION_API"

export type WhatsappConversationStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "ABANDONED"
  | "TAKEOVER"
  | "BLOCKED"

export type WhatsappMessageRole =
  | "USER"
  | "ASSISTANT"
  | "STAFF"
  | "TOOL"
  | "SYSTEM"

export interface WhatsappConfigView {
  configured: boolean
  isActive: boolean
  provider?: string
  lastTestAt?: string | null
  lastTestOk?: boolean | null
  lastTestError?: string | null
  isConnected?: boolean
  connectedPhone?: string | null
  connectedAt?: string | null
  messagesCount?: number
  activeChatCount?: number
}

export interface UpsertWhatsappConfigInput {
  provider: WhatsappProviderName
  isActive?: boolean
}

export interface UpsertWhatsappConfigResult {
  configured: boolean
  isActive: boolean
  verified: boolean
  verifiedPhone?: string
  verifiedError?: string
}

export interface TestWhatsappResult {
  ok: boolean
  state?: string
  phone?: string
  error?: string
}

export interface WhatsappStatusView {
  isActive: boolean
  isConnected: boolean
  provider: string | null
  evolutionState: string | null
  connectedPhone: string | null
  connectedAt: string | null
  disconnectedAt: string | null
  uptimeSeconds: number | null
  messagesCount: number
  activeChatCount: number
  lastErrorAt: string | null
  lastErrorMessage: string | null
}

export interface WhatsappAgentConfigView {
  aiModel: string
  aiTemperature: number
  aiMaxTokens: number
  aiApiKeyConfigured: boolean
  systemPromptAr: string
  systemPromptEn: string
  greetingAr: string | null
  greetingEn: string | null
  defaultLanguage: "ar" | "en"
  businessHoursOnly: boolean
  activeDays: number[]
}

export interface UpsertWhatsappAgentConfigInput {
  aiModel: string
  aiTemperature: number
  aiMaxTokens: number
  aiApiKey?: string
  systemPromptAr: string
  systemPromptEn: string
  greetingAr?: string
  greetingEn?: string
  defaultLanguage: "ar" | "en"
  businessHoursOnly?: boolean
  activeDays?: number[]
}

export interface WhatsappQrView {
  status: "pending" | "connected" | "disconnected" | "not_configured"
  base64: string | null
  pairingCode: string | null
  count: number
  connectedPhone: string | null
  error: string | null
}

export interface WhatsappConversationSummary {
  id: string
  phone: string
  contactName: string | null
  clientId: string | null
  clientName: string | null
  status: WhatsappConversationStatus
  language: string
  staffTakeover: boolean
  unreadCount: number
  lastInboundAt: string | null
  lastMessageAt: string
  messageCount: number
  lastMessagePreview: string | null
}

export interface WhatsappConversationList {
  items: WhatsappConversationSummary[]
  total: number
  page: number
  pageSize: number
  totalPages?: number
}

export interface WhatsappMessageView {
  id: string
  role: WhatsappMessageRole
  content: string
  toolCalls?: unknown
  toolResults?: unknown
  tokenUsage?: number | null
  latencyMs?: number | null
  errorMessage?: string | null
  deliveryStatus?: "PENDING" | "SENT" | "FAILED" | null
  providerMessageId?: string | null
  externalMessageId?: string | null
  inReplyToExternalMessageId?: string | null
  readAt?: string | null
  createdAt: string
}

export interface WhatsappConversationDetail {
  id: string
  phone: string
  contactName?: string | null
  clientId: string | null
  status: WhatsappConversationStatus
  language: string
  context: unknown
  staffTakeover: boolean
  staffUserId: string | null
  staffTookOverAt: string | null
  unreadCount?: number
  lastInboundAt?: string | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  messages: WhatsappMessageView[]
}

export interface StaffReplyInput {
  message: string
}

export interface StaffReplyResult {
  ok: boolean
  messageId: string | undefined
  error: string | undefined
  persistedMessageId: string
}

export interface WhatsappControlInput {
  action: "start" | "stop" | "restart"
}

export interface WhatsappControlResult {
  action: "start" | "stop" | "restart"
  isActive: boolean
}
