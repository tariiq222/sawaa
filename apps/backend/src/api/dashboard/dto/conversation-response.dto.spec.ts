import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  ConversationAssistantRecoveryMetadataDto,
  ConversationCursorMetaDto,
  ConversationHandoffMessageMetadataDto,
  ConversationHandoffSummaryDto,
  ConversationInboxResponseDto,
  ConversationMessageResponseDto,
  ConversationMessagesResponseDto,
  ConversationOperationMetadataDto,
  ConversationOperationResultMetadataDto,
  ConversationPublicOperationDto,
  ConversationReadResponseDto,
  ConversationResponseDto,
} from './conversation-response.dto';
import type {
  PublicChatAssistantRecoveryMetadata,
  PublicChatHandoffMetadata,
  PublicChatOperationResultMetadata,
} from '../../../modules/comms/chat/messages/chat-message.mapper';
import type {
  ChatOperationCardMetadata,
  PublicChatOperation,
} from '../../../modules/comms/chat/operations/chat-operation-public.mapper';
import type { HandoffSummary } from '../../../modules/comms/chat/assistant/administrative-tools.service';
import type { toChatMessageResponse } from '../../../modules/comms/chat/messages/chat-message.mapper';
import type { toStaffConversationResponse } from '../../../modules/comms/chat/staff/staff-conversation.mapper';
import type { ListInboxHandler } from '../../../modules/comms/chat/staff/list-inbox.handler';
import type { GetConversationHandler } from '../../../modules/comms/chat/staff/get-conversation.handler';
import type { ListConversationMessagesHandler } from '../../../modules/comms/chat/staff/list-conversation-messages.handler';
import type { ClaimConversationHandler } from '../../../modules/comms/chat/staff/claim-conversation.handler';
import type { MarkConversationReadHandler } from '../../../modules/comms/chat/staff/mark-conversation-read.handler';
import type { ReplyConversationHandler } from '../../../modules/comms/chat/staff/reply-conversation.handler';
import type { AssignConversationHandler } from '../../../modules/comms/chat/staff/assign-conversation.handler';
import type { ReleaseConversationHandler } from '../../../modules/comms/chat/staff/release-conversation.handler';
import type { CloseConversationHandler } from '../../../modules/comms/chat/staff/close-conversation.handler';

// ── Compile-time exactness: DTO <=> INFERRED handler output ─────────────────
//
// No handler under src/modules imports from this layer (enforced by
// `git grep -l "api/dashboard/dto" -- src/modules`). Each assertion below reads
// the handler's INFERRED return type (or the mapper's inferred return type for
// routes whose controller applies a mapper), so it proves BOTH that the DTO
// covers what the handler really produces and that it documents nothing extra.

type Expect<T extends true> = T;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * Structural equality. DTO fields are typed as classes while handlers return
 * object literals, so identity comparison is useless here: `Norm` flattens every
 * object and array element first, then `Extends` checks assignability in BOTH
 * directions. Optionality survives because `Norm` keeps a lone `undefined` in
 * the property type, so `required` vs `optional` is still a mismatch.
 */
type Prim = string | number | boolean | bigint | symbol | null | undefined | Date;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Norm<T> = IsAny<T> extends true ? T
  : T extends unknown
    ? T extends Prim ? T
    : T extends readonly (infer E)[] ? Norm<E>[]
    : T extends (...a: never[]) => unknown ? T
    : { [K in keyof T]: Norm<T[K]> }
  : never;
type Extends<A, B> = [A] extends [B] ? true : false;
type Equal<A, B> = Extends<Norm<A>, Norm<B>> extends true
  ? Extends<Norm<B>, Norm<A>>
  : false;

// ── Routes whose handler result is returned through a mapper ───────────────

type StaffConversationMapped = ReturnType<typeof toStaffConversationResponse>;
type ChatMessageMapped = ReturnType<typeof toChatMessageResponse>;

/** `GET /dashboard/conversations` — `ListInboxHandler` (`{ data, meta }`). */
export type ListInboxMatches = Expect<Equal<Result<ListInboxHandler, 'execute'>, ConversationInboxResponseDto>>;
/** `GET /dashboard/conversations/:conversationId` — inferred handler output. */
export type GetConversationMatches = Expect<Equal<Result<GetConversationHandler, 'execute'>, ConversationResponseDto>>;
/** `GET .../messages` (`ListConversationMessagesHandler`). */
export type ListMessagesMatches = Expect<
  Equal<Result<ListConversationMessagesHandler, 'execute'>, ConversationMessagesResponseDto>
>;
/** `POST .../claim`, `.../assign`, `.../release`, `.../close` map the raw row. */
export type StaffConversationMapperMatches = Expect<Equal<StaffConversationMapped, ConversationResponseDto>>;
export type ClaimMatches = Expect<Equal<ReturnType<typeof toStaffConversationResponse>, ConversationResponseDto>>;
export type AssignMatches = Expect<Equal<ReturnType<typeof toStaffConversationResponse>, ConversationResponseDto>>;
export type ReleaseMatches = Expect<Equal<ReturnType<typeof toStaffConversationResponse>, ConversationResponseDto>>;
export type CloseMatches = Expect<Equal<ReturnType<typeof toStaffConversationResponse>, ConversationResponseDto>>;
/** `POST .../read` — inferred handler output. */
export type ReadMatches = Expect<Equal<Result<MarkConversationReadHandler, 'execute'>, ConversationReadResponseDto>>;
/** `POST .../messages` maps the raw message row. */
export type ReplyMatches = Expect<Equal<ChatMessageMapped, ConversationMessageResponseDto>>;

/**
 * The four state-transition handlers return the full `ChatConversation` row
 * (pre-existing module annotations, unchanged by this unit) which the controller
 * feeds to `toStaffConversationResponse`. The mapper's select projection is
 * narrower, so this is a one-way assignability check: every field the mapper
 * reads exists on the raw row with the same type. The mapped output assertion
 * above then pins the wire shape.
 */
type ChatConversationRow = Parameters<typeof toStaffConversationResponse>[0];
export type ClaimRowAccepted = Expect<Extends<Result<ClaimConversationHandler, 'execute'>, ChatConversationRow>>;
export type AssignRowAccepted = Expect<Extends<Result<AssignConversationHandler, 'execute'>, ChatConversationRow>>;
export type ReleaseRowAccepted = Expect<Extends<Result<ReleaseConversationHandler, 'execute'>, ChatConversationRow>>;
export type CloseRowAccepted = Expect<Extends<Result<CloseConversationHandler, 'execute'>, ChatConversationRow>>;

/** `ReplyConversationHandler.execute` forwards to the message handler. */
type ChatMessageSource = Parameters<typeof toChatMessageResponse>[0];
export type ReplyRowIsMessage = Expect<Extends<Result<ReplyConversationHandler, 'execute'>, ChatMessageSource>>;

// ── Metadata union: each documented class is structurally its mapper type ───
//
// The response class only imports the union type, so the four `@ApiProperty`
// classes used to render the `oneOf` could drift from the mapper without the
// envelope assertion noticing. These pin each variant.

export type HandoffSummaryMatches = Expect<Equal<ConversationHandoffSummaryDto, HandoffSummary>>;
export type HandoffMetadataMatches = Expect<
  Equal<ConversationHandoffMessageMetadataDto, PublicChatHandoffMetadata>
>;
export type AssistantRecoveryMatches = Expect<
  Equal<ConversationAssistantRecoveryMetadataDto, PublicChatAssistantRecoveryMetadata>
>;
export type OperationMetadataMatches = Expect<
  Equal<ConversationOperationMetadataDto, ChatOperationCardMetadata>
>;
export type OperationResultMetadataMatches = Expect<
  Equal<ConversationOperationResultMetadataDto, PublicChatOperationResultMetadata>
>;
export type PublicOperationMatches = Expect<Equal<ConversationPublicOperationDto, PublicChatOperation>>;

// ── Negative controls: the equality helper is not vacuous ───────────────────

type ConversationRow = Result<GetConversationHandler, 'execute'>;
type ConversationMessageRow = Result<ListConversationMessagesHandler, 'execute'>['data'][number];
type N_extraKey = Equal<ConversationRow, ConversationResponseDto & { extra: 1 }>;
type N_missingKey = Equal<ConversationRow, Omit<ConversationResponseDto, 'handoffSummary'>>;
type N_changedType = Equal<ConversationRow, Omit<ConversationResponseDto, 'staffUnreadCount'> & { staffUnreadCount: string }>;
type N_optionality = Equal<ConversationRow, Omit<ConversationResponseDto, 'guestName'> & { guestName?: string | null }>;
type N_nestedType = Equal<
  ConversationMessageRow,
  Omit<ConversationMessageResponseDto, 'senderType'> & { senderType: 'STAFF' }
>;
type N_nullability = Equal<ConversationRow, Omit<ConversationResponseDto, 'clientId'> & { clientId: string }>;
type N_wrongRoute = Equal<ConversationRow, ConversationMessageResponseDto>;
type N_metaOptionality = Equal<
  Result<ListInboxHandler, 'execute'>,
  Omit<ConversationInboxResponseDto, 'meta'> & { meta?: ConversationCursorMetaDto }
>;
export type ControlsReject = Expect<
  [
    N_extraKey, N_missingKey, N_changedType, N_optionality, N_nestedType,
    N_nullability, N_wrongRoute, N_metaOptionality,
  ] extends [false, false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        ConversationResponseDto,
        ConversationMessageResponseDto,
        ConversationCursorMetaDto,
        ConversationInboxResponseDto,
        ConversationMessagesResponseDto,
        ConversationReadResponseDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('conversation response schemas (output shape)', () => {
  it('documents every conversation key as required and integer counters as integers', async () => {
    const schema = (await buildSchemas()).ConversationResponseDto;
    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'id', 'clientId', 'isAiChat', 'status', 'guestName', 'guestPhone', 'language',
        'assignedStaffUserId', 'handoffRequestedAt', 'staffClaimedAt', 'closedAt',
        'staffUnreadCount', 'clientUnreadCount', 'lastMessageAt', 'createdAt', 'updatedAt',
        'handoffSummary',
      ].sort(),
    );
    expect(schema.properties?.status).toMatchObject({
      enum: ['OPEN', 'AI_ACTIVE', 'WAITING_FOR_STAFF', 'STAFF_ACTIVE', 'CLOSED'],
    });
    for (const key of ['staffUnreadCount', 'clientUnreadCount']) {
      expect(schema.properties?.[key]).toMatchObject({ type: 'integer' });
    }
    expect(schema.properties?.clientId).toMatchObject({ type: 'string', nullable: true });
    expect(schema.properties?.handoffSummary).toMatchObject({ nullable: true, allOf: [{ $ref: '#/components/schemas/ConversationHandoffSummaryDto' }] });
  });

  it('documents the message kind/sender enums and optional safe metadata', async () => {
    const schema = (await buildSchemas()).ConversationMessageResponseDto;
    expect([...(schema.required ?? [])].sort()).toEqual(
      ['id', 'conversationId', 'senderType', 'body', 'kind', 'clientMessageId', 'createdAt'].sort(),
    );
    expect(schema.properties?.senderType).toMatchObject({
      enum: ['CLIENT', 'EMPLOYEE', 'VISITOR', 'AI', 'STAFF', 'SYSTEM'],
    });
    expect(schema.properties?.kind).toMatchObject({
      enum: ['TEXT', 'ACTION_CARD', 'OPERATION_RESULT', 'SYSTEM_EVENT'],
    });
    expect(schema.properties?.metadata).toMatchObject({ oneOf: expect.any(Array) });
  });

  it('documents the inbox and messages envelopes with cursor meta', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.ConversationInboxResponseDto.required ?? [])].sort()).toEqual(['data', 'meta'].sort());
    expect(schemas.ConversationInboxResponseDto.properties?.data).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ConversationResponseDto' },
    });
    expect([...(schemas.ConversationMessagesResponseDto.required ?? [])].sort()).toEqual(['data', 'meta'].sort());
    expect([...(schemas.ConversationCursorMetaDto.required ?? [])].sort()).toEqual(
      ['limit', 'nextCursor', 'hasMore'].sort(),
    );
    expect(schemas.ConversationCursorMetaDto.properties?.limit).toMatchObject({ type: 'integer' });
  });

  it('documents the read receipt as count + timestamp', async () => {
    const schema = (await buildSchemas()).ConversationReadResponseDto;
    expect([...(schema.required ?? [])].sort()).toEqual(['markedReadCount', 'readAt'].sort());
    expect(schema.properties?.markedReadCount).toMatchObject({ type: 'integer' });
    expect(schema.properties?.readAt).toMatchObject({ type: 'string', format: 'date-time' });
  });
});
