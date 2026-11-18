import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import {
  PublicGuestChatAssistantRecoveryMetadataDto,
  PublicGuestChatConversationDto,
  PublicGuestChatHandoffMetadataDto,
  PublicGuestChatMessageCursorMetaDto,
  PublicGuestChatMessageDto,
  PublicGuestChatMessagePageDto,
  PublicGuestChatOperationCardMetadataDto,
  PublicGuestChatOperationDto,
  PublicGuestChatOperationResultMetadataDto,
} from './guest-chat-response.dto';
import { PublicContactMessageDto } from './contact-message-response.dto';
import { PublicVerifyEmailResponseDto } from './verify-email-response.dto';
import { PublicOtpVerifyResponseDto } from './otp-response.dto';
import { PublicIntakeResponseDto } from './intake-response.dto';
import { PublicAvailabilitySlotDto } from './availability-response.dto';

import { toChatConversationResponse } from '../../modules/comms/chat/guest/chat-conversation.response';
import type { toChatMessageResponse } from '../../modules/comms/chat/messages/chat-message.mapper';
import { toChatMessageResponse as mapChatMessage } from '../../modules/comms/chat/messages/chat-message.mapper';
import type { ListChatMessagesResult } from '../../modules/comms/chat/messages/list-chat-messages.handler';
import type { GetPublicAvailabilityHandler } from '../../modules/bookings/availability/public/get-public-availability.handler';

// ── Compile-time exactness: DTO <=> INFERRED payload type ──────────────────
//
// The controllers annotate `Promise<Dto>`, which proves the payload fits the
// DTO. These assertions also prove the DTO documents nothing the payload never
// carries. Nothing under `src/modules` imports this layer; every module import
// above is `import type`, so handler/mapper outputs stay INFERRED.

type Expect<T extends true> = T;
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
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

/** Conversation projection returned by `toChatConversationResponse`. */
type ConversationPayload = ReturnType<typeof toChatConversationResponse>;
/** Message projection returned by `toChatMessageResponse`. */
type MessagePayload = ReturnType<typeof toChatMessageResponse>;

// ── Every in-scope route, against its INFERRED payload type ────────────────

/** POST /public/chat/conversations, GET /public/chat/conversations/current, POST .../handoff */
export type ConversationMatches = Expect<Equal<ConversationPayload, PublicGuestChatConversationDto>>;
/** POST /public/chat/conversations/{conversationId}/messages */
export type SendMessageMatches = Expect<Equal<MessagePayload, PublicGuestChatMessageDto>>;
/** GET /public/chat/conversations/{conversationId}/messages */
export type ListMessagesMatches = Expect<Equal<ListChatMessagesResult, PublicGuestChatMessagePageDto>>;
/** GET /public/availability */
export type PublicAvailabilityMatches = Expect<
  Equal<Result<GetPublicAvailabilityHandler, 'execute'>, PublicAvailabilitySlotDto[]>
>;

// ── Negative controls: the equality helper is not vacuous ──────────────────

type Conv = ConversationPayload;
type Msg = MessagePayload;
type N_convExtraKey = Equal<Conv, PublicGuestChatConversationDto & { extra: 1 }>;
type N_convMissingKey = Equal<Conv, Omit<PublicGuestChatConversationDto, 'language'>>;
type N_convOptionality = Equal<Conv, Omit<PublicGuestChatConversationDto, 'status'> & { status?: string }>;
type N_convChangedType = Equal<Conv, Omit<PublicGuestChatConversationDto, 'createdAt'> & { createdAt: string }>;
/** The conversation projection must never gain the guest credential fields. */
type N_convLeaksGuestHash = Equal<Conv, Conv & { guestTokenHash: string | null }>;
type N_msgExtraKey = Equal<Msg, PublicGuestChatMessageDto & { sequence: number }>;
type N_msgMetadataWidened = Equal<Msg, Omit<PublicGuestChatMessageDto, 'metadata'> & { metadata?: Record<string, unknown> }>;
type N_msgRequiredMetadata = Equal<Msg, Omit<PublicGuestChatMessageDto, 'metadata'> & { metadata: PublicGuestChatMessageDto['metadata'] }>;
type N_pageMissingMeta = Equal<ListChatMessagesResult, Omit<PublicGuestChatMessagePageDto, 'meta'>>;
type N_wrongRoute = Equal<MessagePayload, PublicGuestChatConversationDto>;
export type ControlsReject = Expect<
  [
    N_convExtraKey, N_convMissingKey, N_convOptionality, N_convChangedType, N_convLeaksGuestHash,
    N_msgExtraKey, N_msgMetadataWidened, N_msgRequiredMetadata, N_pageMissingMeta, N_wrongRoute,
  ] extends [false, false, false, false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        PublicGuestChatConversationDto,
        PublicGuestChatMessageDto,
        PublicGuestChatMessagePageDto,
        PublicGuestChatMessageCursorMetaDto,
        PublicGuestChatHandoffMetadataDto,
        PublicGuestChatAssistantRecoveryMetadataDto,
        PublicGuestChatOperationCardMetadataDto,
        PublicGuestChatOperationDto,
        PublicGuestChatOperationResultMetadataDto,
        PublicContactMessageDto,
        PublicVerifyEmailResponseDto,
        PublicOtpVerifyResponseDto,
        PublicIntakeResponseDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('public guest surface response schemas (output shape)', () => {
  it('documents the guest conversation without any guest credential field', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicGuestChatConversationDto.required ?? [])].sort()).toEqual(
      ['clientId', 'createdAt', 'employeeId', 'id', 'isAiChat', 'language', 'status', 'updatedAt'].sort(),
    );
    const keys = Object.keys(schemas.PublicGuestChatConversationDto.properties ?? {});
    expect(keys.sort()).toEqual(
      ['clientId', 'createdAt', 'employeeId', 'id', 'isAiChat', 'language', 'status', 'updatedAt'].sort(),
    );
    // The HttpOnly-cookie credential (raw token, stored hash) is never documented.
    expect(keys.some((key) => /token|hash|guestPhone|guestName/i.test(key))).toBe(false);
    expect(schemas.PublicGuestChatConversationDto.properties?.status).toMatchObject({
      enum: ['OPEN', 'AI_ACTIVE', 'WAITING_FOR_STAFF', 'STAFF_ACTIVE', 'CLOSED'],
    });
  });

  it('documents the guest message with optional metadata variants as oneOf refs', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicGuestChatMessageDto.required ?? [])].sort()).toEqual(
      ['body', 'clientMessageId', 'conversationId', 'createdAt', 'id', 'kind', 'senderType'].sort(),
    );
    const metadata = schemas.PublicGuestChatMessageDto.properties?.metadata as { oneOf?: Array<{ $ref: string }> };
    expect(metadata.oneOf?.map((entry) => entry.$ref)).toEqual([
      '#/components/schemas/PublicGuestChatHandoffMetadataDto',
      '#/components/schemas/PublicGuestChatAssistantRecoveryMetadataDto',
      '#/components/schemas/PublicGuestChatOperationCardMetadataDto',
      '#/components/schemas/PublicGuestChatOperationResultMetadataDto',
    ]);
    expect(schemas.PublicGuestChatMessageDto.properties?.kind).toMatchObject({
      enum: ['TEXT', 'ACTION_CARD', 'OPERATION_RESULT', 'SYSTEM_EVENT'],
    });
    expect(schemas.PublicGuestChatMessageDto.properties?.senderType).toMatchObject({
      enum: ['CLIENT', 'EMPLOYEE', 'VISITOR', 'AI', 'STAFF', 'SYSTEM'],
    });
  });

  it('documents the message page envelope and its keyset meta', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicGuestChatMessagePageDto.required ?? [])].sort()).toEqual(['data', 'meta'].sort());
    expect(schemas.PublicGuestChatMessagePageDto.properties?.data).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PublicGuestChatMessageDto' },
    });
    expect([...(schemas.PublicGuestChatMessageCursorMetaDto.required ?? [])].sort()).toEqual(
      ['hasMore', 'limit', 'nextCursor'].sort(),
    );
    expect(schemas.PublicGuestChatMessageCursorMetaDto.properties?.limit).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 100,
    });
  });

  it('keeps chat counters integral and the operation summary free-form', async () => {
    const schemas = await buildSchemas();
    for (const key of ['version', 'requiredConfirmations', 'confirmationCount']) {
      expect(schemas.PublicGuestChatOperationDto.properties?.[key]).toMatchObject({ type: 'integer', minimum: 0 });
    }
    expect(schemas.PublicGuestChatOperationDto.properties?.summary).toMatchObject({
      type: 'object',
      additionalProperties: true,
    });
    expect(schemas.PublicGuestChatOperationResultMetadataDto.properties?.status).toMatchObject({
      enum: ['SUCCEEDED', 'FAILED', 'DECLINED'],
    });
    // Optional fields must stay optional — the mapper omits them when absent.
    for (const key of ['bookingId', 'outcome', 'syncPending']) {
      expect(schemas.PublicGuestChatOperationResultMetadataDto.required ?? []).not.toContain(key);
    }
  });

  it('documents the contact-message acknowledgement projection only', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicContactMessageDto.required ?? [])].sort()).toEqual(
      ['createdAt', 'id', 'status'].sort(),
    );
    expect(Object.keys(schemas.PublicContactMessageDto.properties ?? {}).sort()).toEqual(
      ['createdAt', 'id', 'status'].sort(),
    );
    expect(schemas.PublicContactMessageDto.properties?.status).toMatchObject({
      enum: ['NEW', 'READ', 'REPLIED', 'ARCHIVED'],
    });
  });

  it('documents the verify-email and OTP-verify bodies without secrets in examples', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicVerifyEmailResponseDto.required ?? [])]).toEqual(['success']);
    expect([...(schemas.PublicOtpVerifyResponseDto.required ?? [])]).toEqual(['sessionToken']);
    const sessionToken = schemas.PublicOtpVerifyResponseDto.properties?.sessionToken;
    const example = String(sessionToken && 'example' in sessionToken ? sessionToken.example ?? '' : '');
    expect(example.length).toBeGreaterThan(0);
    expect(example).toContain('placeholder');
  });

  it('documents the intake response with nullable clientId and optional createdAt', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicIntakeResponseDto.required ?? [])].sort()).toEqual(
      ['answers', 'bookingId', 'clientId', 'formId', 'id'].sort(),
    );
    expect(schemas.PublicIntakeResponseDto.required ?? []).not.toContain('createdAt');
    expect(schemas.PublicIntakeResponseDto.properties?.clientId).toMatchObject({ nullable: true, type: 'string' });
    expect(schemas.PublicIntakeResponseDto.properties?.answers).toMatchObject({
      type: 'object',
      additionalProperties: true,
    });
  });
});

// ── Runtime-unchanged proofs (mapper output keys) ──────────────────────────

describe('guest chat mapper output is unchanged', () => {
  it('returns exactly the documented conversation keys', () => {
    const payload = {
      id: 'c1', clientId: null, employeeId: null, isAiChat: true, status: 'AI_ACTIVE',
      language: 'ar', createdAt: new Date('2026-10-10T09:00:00.000Z'),
      updatedAt: new Date('2026-10-10T09:00:00.000Z'),
      // Extra columns exist on the Prisma row and must not be forwarded.
      guestTokenHash: 'hmac', guestName: 'سارة', guestPhone: '+966501234567', stateVersion: 3,
    } as unknown as Parameters<typeof toChatConversationResponse>[0];
    const result = toChatConversationResponse(payload);
    expect(Object.keys(result).sort()).toEqual(
      ['clientId', 'createdAt', 'employeeId', 'id', 'isAiChat', 'language', 'status', 'updatedAt'].sort(),
    );
  });

  it('omits metadata when the mapper finds nothing safe to expose', () => {
    const result = mapChatMessage({
      id: 'm1', conversationId: 'c1', senderType: 'VISITOR', body: 'hello', kind: 'TEXT',
      clientMessageId: null, createdAt: new Date('2026-10-10T09:00:00.000Z'),
      metadata: { secret: 'never-forwarded' },
    } as unknown as Parameters<typeof mapChatMessage>[0]);
    expect(Object.keys(result).sort()).toEqual(
      ['body', 'clientMessageId', 'conversationId', 'createdAt', 'id', 'kind', 'senderType'].sort(),
    );
  });
});
