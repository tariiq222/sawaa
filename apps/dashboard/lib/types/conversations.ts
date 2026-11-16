/**
 * Reception chat (conversation inbox) types — Sawaa Dashboard
 *
 * Every shape here is derived from the committed OpenAPI snapshot
 * (`lib/types/api.generated.ts`), so a backend response/query change becomes a
 * type error instead of drifting silently.
 * `test/unit/lib/conversation-type-contract.spec.ts` pins the derivation.
 *
 * The inbox routes (`/dashboard/conversations/*`) are the reception chat;
 * "handoffSummary" is the safe projection the backend builds with
 * `parseHandoffSummary`, never the raw customer context.
 */

import type { components, paths } from "@/lib/types/api.generated"

type Schemas = components["schemas"]

/* ─── Entities (derived from OpenAPI) ─── */

/** Conversation lifecycle status (Prisma `ConversationStatus`). */
export type ConversationStatus = Schemas["ConversationResponseDto"]["status"]

/** Inbox assignment filter accepted by `GET /dashboard/conversations`. */
export type ConversationAssignmentFilter = NonNullable<ConversationFilters["assigned"]>

/** Message author type (Prisma `MessageSenderType`). */
export type ConversationSenderType = Schemas["ConversationMessageResponseDto"]["senderType"]

/** Message kind (Prisma `ChatMessageKind`). */
export type ConversationMessageKind = Schemas["ConversationMessageResponseDto"]["kind"]

/** Safe hand-off summary projection; `null` when no hand-off was requested. */
export type HandoffSummary = NonNullable<Schemas["ConversationResponseDto"]["handoffSummary"]>

/** Inbox row / conversation detail (`GET /dashboard/conversations`). */
export type Conversation = Schemas["ConversationResponseDto"]

/** One transcript message (`GET .../messages` and the reply response). */
export type ConversationMessage = Schemas["ConversationMessageResponseDto"]

/** Keyset pagination metadata used by both cursor lists. */
export type CursorMeta = Schemas["ConversationCursorMetaDto"]

/** `GET /dashboard/conversations` response. */
export type ConversationListResponse = Schemas["ConversationInboxResponseDto"]

/** `GET /dashboard/conversations/:conversationId/messages` response. */
export type ConversationMessagesResponse = Schemas["ConversationMessagesResponseDto"]

/** `POST /dashboard/conversations/:conversationId/read` response. */
export type MarkConversationReadResponse = Schemas["ConversationReadResponseDto"]

/* ─── Queries (derived from OpenAPI) ─── */

/** `GET /dashboard/conversations` query surface. */
export type ConversationFilters = NonNullable<
  paths["/api/v1/dashboard/conversations"]["get"]["parameters"]["query"]
>

/** `GET /dashboard/conversations/:conversationId/messages` query surface. */
export type ConversationMessageFilters = NonNullable<
  paths["/api/v1/dashboard/conversations/{conversationId}/messages"]["get"]["parameters"]["query"]
>

/* ─── Write payloads (derived from OpenAPI) ─── */

/** `POST /dashboard/conversations/:conversationId/messages` body. */
export type ReplyConversationPayload = Schemas["SendChatMessageDto"]

/** `POST /dashboard/conversations/:conversationId/read` body. */
export type MarkConversationReadPayload = Schemas["MarkConversationReadDto"]
