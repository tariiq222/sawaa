import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { ChatConversation, CommsChatMessage } from '@prisma/client';
import {
  StaffChatConversationDetailDto,
  StaffChatConversationListResponseDto,
  StaffChatConversationRecordDto,
  StaffChatCursorMetaDto,
  StaffChatMessageListResponseDto,
  StaffChatMessageRecordDto,
} from './staff-chat-response.dto';
import type { ListConversationsHandler } from '../../../modules/comms/chat/list-conversations.handler';
import type { ListMessagesHandler } from '../../../modules/comms/chat/list-messages.handler';
import type { GetConversationHandler } from '../../../modules/comms/chat/get-conversation.handler';
import type { CloseConversationHandler } from '../../../modules/comms/chat/close-conversation.handler';
import type { SendStaffMessageHandler } from '../../../modules/comms/chat/send-staff-message.handler';

// ── Compile-time exactness: DTO <=> INFERRED handler output ─────────────────
//
// None of these handlers is annotated with a DTO and none imports this layer
// (enforced by `git grep -l "api/dashboard/dto" -- src/modules`). Each assertion
// reads the INFERRED return type, so it proves BOTH coverage and exactness.

type Expect<T extends true> = T;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

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

/** `GET /dashboard/comms/chat/conversations` (toListResponse envelope). */
export type ListConversationsMatches = Expect<
  Equal<Result<ListConversationsHandler, 'execute'>, StaffChatConversationListResponseDto>
>;
/** `GET .../conversations/:id/messages` (raw `CommsChatMessage` rows). */
export type ListMessagesMatches = Expect<
  Equal<Result<ListMessagesHandler, 'execute'>, StaffChatMessageListResponseDto>
>;
/** `GET .../conversations/:id` (derived projection). */
export type GetConversationMatches = Expect<
  Equal<Result<GetConversationHandler, 'execute'>, StaffChatConversationDetailDto>
>;
/** `PATCH .../conversations/:id/close` returns the raw `ChatConversation`. */
export type CloseConversationMatches = Expect<
  Equal<Result<CloseConversationHandler, 'execute'>, StaffChatConversationRecordDto>
>;
/** `POST .../conversations/:id/messages` returns the raw `CommsChatMessage`. */
export type SendStaffMessageMatches = Expect<
  Equal<Result<SendStaffMessageHandler, 'execute'>, StaffChatMessageRecordDto>
>;

/**
 * The two raw-record DTOs mirror the Prisma models, including the `BigInt`
 * sequence and the free-form Json columns. These pin that they are not narrower
 * than the rows Prisma really returns. `sequence` is converted at the HTTP
 * boundary by `bigintJsonReplacer` (`main.ts`), covered separately in
 * `common/helpers/json-bigint.http.spec.ts`.
 */
export type MessageRecordMatchesPrisma = Expect<Equal<StaffChatMessageRecordDto, CommsChatMessage>>;
export type ConversationRecordMatchesPrisma = Expect<Equal<StaffChatConversationRecordDto, ChatConversation>>;

// ── Negative controls: the equality helper is not vacuous ───────────────────

type DetailRow = Result<GetConversationHandler, 'execute'>;
type ListRow = Result<ListConversationsHandler, 'execute'>['items'][number];
type N_extraKey = Equal<DetailRow, StaffChatConversationDetailDto & { extra: 1 }>;
type N_missingKey = Equal<DetailRow, Omit<StaffChatConversationDetailDto, 'messages'>>;
type N_changedType = Equal<DetailRow, Omit<StaffChatConversationDetailDto, 'startedAt'> & { startedAt: string }>;
type N_optionality = Equal<ListRow, Omit<ListRow, 'endedAt'> & { endedAt?: Date | null }>;
type N_nestedType = Equal<
  ListRow,
  Omit<ListRow, 'user'> & { user: { id: string; firstName: string; lastName: string } }
>;
type N_metaOptionality = Equal<
  Result<ListConversationsHandler, 'execute'>,
  Omit<StaffChatConversationListResponseDto, 'meta'> & { meta?: StaffChatCursorMetaDto }
>;
type N_bigintAsNumber = Equal<StaffChatMessageRecordDto, Omit<CommsChatMessage, 'sequence'> & { sequence: number }>;
type N_jsonNarrowed = Equal<StaffChatConversationRecordDto, Omit<ChatConversation, 'customerContext'> & { customerContext: string | null }>;
export type R1 = Expect<N_extraKey extends false ? true : false>;
export type R2 = Expect<N_missingKey extends false ? true : false>;
export type R3 = Expect<N_changedType extends false ? true : false>;
export type R4 = Expect<N_optionality extends false ? true : false>;
export type R5 = Expect<N_nestedType extends false ? true : false>;
export type R6 = Expect<N_metaOptionality extends false ? true : false>;
export type R7 = Expect<N_bigintAsNumber extends false ? true : false>;
export type R8 = Expect<N_jsonNarrowed extends false ? true : false>;


// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        StaffChatConversationDetailDto,
        StaffChatConversationListResponseDto,
        StaffChatConversationRecordDto,
        StaffChatMessageListResponseDto,
        StaffChatMessageRecordDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('staff chat response schemas (output shape)', () => {
  it('documents the legacy conversation list envelope', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.StaffChatConversationListResponseDto.required ?? [])].sort()).toEqual(['items', 'meta'].sort());
    expect([...(schemas.StaffChatListMetaDto.required ?? [])].sort()).toEqual(
      ['total', 'page', 'limit', 'totalPages', 'hasNextPage', 'hasPreviousPage'].sort(),
    );
    const row = schemas.StaffChatConversationListRowDto;
    expect([...(row.required ?? [])].sort()).toEqual(
      ['id', 'clientId', 'employeeId', 'handedOff', 'startedAt', 'endedAt', 'lastMessageAt', 'user', '_count'].sort(),
    );
    expect(row.properties?.startedAt).toMatchObject({ type: 'string', format: 'date-time' });
    expect(row.properties?.endedAt).toMatchObject({ type: 'string', format: 'date-time', nullable: true });
  });

  it('documents the derived conversation detail with its role enum', async () => {
    const schema = (await buildSchemas()).StaffChatConversationDetailDto;
    expect([...(schema.required ?? [])].sort()).toEqual(
      ['id', 'clientId', 'employeeId', 'handedOff', 'startedAt', 'endedAt', 'lastMessageAt', 'user', 'messages'].sort(),
    );
    expect(schema.properties?.messages).toMatchObject({ type: 'array' });
  });

  it('documents raw message rows: enum sender/kind, BigInt sequence, free-form metadata', async () => {
    const schema = (await buildSchemas()).StaffChatMessageRecordDto;
    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'id', 'conversationId', 'senderType', 'senderId', 'body', 'kind', 'metadata',
        'clientMessageId', 'responseForMessageId', 'sequence', 'model', 'tokensUsed',
        'latencyMs', 'isRead', 'readAt', 'createdAt',
      ].sort(),
    );
    expect(schema.properties?.sequence).toMatchObject({ type: 'integer', format: 'int64' });
    expect(schema.properties?.tokensUsed).toMatchObject({ type: 'integer' });
    expect(schema.properties?.metadata).toMatchObject({ oneOf: expect.any(Array) });
  });

  it('documents the raw conversation row on close, including JSON context', async () => {
    const schema = (await buildSchemas()).StaffChatConversationRecordDto;
    expect(schema.properties?.status).toMatchObject({
      enum: ['OPEN', 'AI_ACTIVE', 'WAITING_FOR_STAFF', 'STAFF_ACTIVE', 'CLOSED'],
    });
    expect(schema.properties?.customerContext).toMatchObject({ oneOf: expect.any(Array) });
    expect(schema.properties?.staffUnreadCount).toMatchObject({ type: 'integer' });
  });
});
