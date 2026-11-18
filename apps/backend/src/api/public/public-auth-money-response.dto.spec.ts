import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { PublicAuthClientSessionResponseDto } from './public-auth-response.dto';
import {
  PublicBookingInvoiceResponseDto,
  PublicInvoicePaymentDto,
  PublicInvoicePdfUrlDto,
  PublicInvoiceResponseDto,
} from './public-invoice-response.dto';
import { PublicBookingRescheduleResponseDto } from './public-booking-response.dto';
import { PublicRefundRequestResponseDto } from './public-refund-request-response.dto';
import { PublicPaymentWebhookAckDto } from './public-payment-webhook-response.dto';
import { SmsWebhookDeliveryReceiptAckDto } from './sms-webhook-response.dto';
import {
  PublicClientChatAssistantRecoveryMetadataDto,
  PublicClientChatConversationDto,
  PublicClientChatHandoffMetadataDto,
  PublicClientChatMessageDto,
  PublicClientChatMessageCursorMetaDto,
  PublicClientChatMessagePageDto,
  PublicClientChatOperationCardMetadataDto,
  PublicClientChatOperationDto,
  PublicClientChatOperationResultMetadataDto,
} from './public-client-chat-response.dto';
import { ClientBookingMutationDto } from '../client/dto/client-booking-response.dto';

import type { GetPublicInvoiceHandler } from '../../modules/finance/get-invoice/get-public-invoice.handler';
import type { GetBookingInvoiceHandler } from '../../modules/finance/get-invoice/get-booking-invoice.handler';
import type { RequestRefundHandler } from '../../modules/finance/refund-payment/request-refund.handler';
import type { MoyasarWebhookHandler } from '../../modules/finance/moyasar-webhook/moyasar-webhook.handler';
import type { SmsDlrHandler } from '../../modules/comms/sms-dlr/sms-dlr.handler';
import type { RegisterHandler } from '../../modules/identity/client-auth/register.handler';
import type { ClientLoginHandler } from '../../modules/identity/client-auth/client-login.handler';
import type { ClientRefreshHandler } from '../../modules/identity/client-auth/client-refresh.handler';
import type { ChatMessageResponse } from '../../modules/comms/chat/messages/chat-message.mapper';
import type { ListChatMessagesResult } from '../../modules/comms/chat/messages/list-chat-messages.handler';
import type { PublicChatOperation } from '../../modules/comms/chat/operations/chat-operation-public.mapper';
import type { toChatConversationResponse } from '../../modules/comms/chat/guest/chat-conversation.response';

// ── Compile-time exactness: DTO <=> INFERRED producer output ───────────────
//
// Nothing under src/modules imports this layer (see the report grep). Each
// assertion reads the producer's INFERRED type, so it proves both that the DTO
// covers what the route really returns and that it documents nothing the route
// never returns. Negative controls at the bottom prove the helper is not
// vacuous.

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

// ── Auth: the three client session routes return exactly { clientId } ─────
//
// The handlers return the credential bundle (`accessToken`, `refreshToken`, ...)
// plus `clientId`; the controllers project it down to `{ clientId }` and put the
// credentials in httpOnly cookies. So the DTO must equal that projection, and
// each handler must indeed carry a string `clientId` to project.
type HasClientId<T> = T extends { clientId: string } ? true : false;
export type RegisterHasClientId = Expect<HasClientId<Result<RegisterHandler, 'execute'>>>;
export type LoginHasClientId = Expect<HasClientId<Result<ClientLoginHandler, 'execute'>>>;
export type RefreshHasClientId = Expect<HasClientId<Result<ClientRefreshHandler, 'execute'>>>;
/** Every route's wire body is exactly `{ clientId }`. */
export type AuthDtoShape = Expect<Equal<PublicAuthClientSessionResponseDto, { clientId: string }>>;
/** Positive control: the handler bundle must NOT be claimed as the wire body. */
type AuthWireIsNotTheCredentialBundle = Equal<PublicAuthClientSessionResponseDto, Result<RegisterHandler, 'execute'>>;
export type AuthBundleRejected = Expect<Equal<AuthWireIsNotTheCredentialBundle, false>>;

// ── Money: invoices, pdf, refund, webhooks ────────────────────────────────
type PublicInvoice = Awaited<ReturnType<GetPublicInvoiceHandler['execute']>>;
export type PublicInvoiceMatches = Expect<Equal<PublicInvoiceResponseDto, PublicInvoice>>;
export type PublicInvoicePaymentMatches = Expect<Equal<PublicInvoicePaymentDto, PublicInvoice['payments'][number]>>;

type BookingInvoice = Awaited<ReturnType<GetBookingInvoiceHandler['execute']>>;
export type PublicBookingInvoiceMatches = Expect<Equal<PublicBookingInvoiceResponseDto, BookingInvoice>>;
export type PublicBookingInvoiceHasNoPayments = Expect<Equal<Extract<'payments' | 'number', keyof BookingInvoice>, never>>;

export type PdfMatches = Expect<Equal<PublicInvoicePdfUrlDto, { url: string }>>;
export type RefundMatches = Expect<Equal<Result<RequestRefundHandler, 'execute'>, PublicRefundRequestResponseDto>>;
export type MoyasarAckMatches = Expect<Equal<Result<MoyasarWebhookHandler, 'execute'>, PublicPaymentWebhookAckDto>>;
export type SmsAckMatches = Expect<Equal<Result<SmsDlrHandler, 'execute'>, SmsWebhookDeliveryReceiptAckDto>>;

// ── Client booking reschedule: the shared projection ──────────────────────
export type RescheduleMatches = Expect<
  Equal<PublicBookingRescheduleResponseDto, { booking: ClientBookingMutationDto }>
>;

// ── Client chat: the same four projections as /client/chat ────────────────
type ConversationPayload = ReturnType<typeof toChatConversationResponse>;
export type PublicConversationMatches = Expect<Equal<PublicClientChatConversationDto, ConversationPayload>>;
export type PublicMessageMatches = Expect<Equal<PublicClientChatMessageDto, ChatMessageResponse>>;
export type PublicMessagePageMatches = Expect<Equal<PublicClientChatMessagePageDto, ListChatMessagesResult>>;
export type PublicOperationMatches = Expect<Equal<PublicClientChatOperationDto, PublicChatOperation>>;
export type PublicOperationCardMatches = Expect<
  Equal<PublicClientChatOperationCardMetadataDto, { action: 'CHAT_OPERATION'; operation: PublicChatOperation }>
>;
export type PublicHandoffMatches = Expect<
  Equal<PublicClientChatHandoffMetadataDto, { action: 'OFFER_HANDOFF'; reason: 'OUT_OF_SCOPE' | 'USER_REQUESTED' | 'LIMIT_REACHED' }>
>;
export type PublicRecoveryMatches = Expect<
  Equal<PublicClientChatAssistantRecoveryMetadataDto, { action: 'ASSISTANT_RECOVERY'; canRetry: boolean }>
>;

// ── Negative controls: the equality helper is not vacuous ─────────────────
type Invoice = PublicInvoice;
type N_invoiceExtraKey = Equal<Invoice, PublicInvoiceResponseDto & { extra: 1 }>;
type N_invoiceMissingKey = Equal<Invoice, Omit<PublicInvoiceResponseDto, 'payments'>>;
type N_invoiceMoneyAsString = Equal<Invoice, Omit<PublicInvoiceResponseDto, 'total'> & { total: string }>;
type N_authExtra = Equal<{ clientId: string }, PublicAuthClientSessionResponseDto & { accessToken: string }>;
type N_pdfExtra = Equal<{ url: string }, PublicInvoicePdfUrlDto & { key: string }>;
type N_convGuestLeak = Equal<ConversationPayload, ConversationPayload & { guestTokenHash: string | null }>;
type N_messageOptionalBody = Equal<ChatMessageResponse, Omit<PublicClientChatMessageDto, 'body'> & { body?: string }>;
type N_chatWrongRoute = Equal<ChatMessageResponse, PublicClientChatConversationDto>;
export type ControlsReject = Expect<
  [
    N_invoiceExtraKey, N_invoiceMissingKey, N_invoiceMoneyAsString, N_authExtra, N_pdfExtra,
    N_convGuestLeak, N_messageOptionalBody, N_chatWrongRoute,
  ] extends [false, false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ─────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        PublicAuthClientSessionResponseDto,
        PublicInvoiceResponseDto,
        PublicInvoicePaymentDto,
        PublicInvoicePdfUrlDto,
        PublicBookingInvoiceResponseDto,
        PublicBookingRescheduleResponseDto,
        PublicRefundRequestResponseDto,
        PublicPaymentWebhookAckDto,
        SmsWebhookDeliveryReceiptAckDto,
        PublicClientChatConversationDto,
        PublicClientChatMessageDto,
        PublicClientChatMessagePageDto,
        PublicClientChatMessageCursorMetaDto,
        PublicClientChatOperationDto,
        PublicClientChatHandoffMetadataDto,
        PublicClientChatAssistantRecoveryMetadataDto,
        PublicClientChatOperationCardMetadataDto,
        PublicClientChatOperationResultMetadataDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('public auth + money + client-chat response schemas', () => {
  it('documents the auth body as only the client id, with no token field', async () => {
    const s = await buildSchemas();
    expect([...(s.PublicAuthClientSessionResponseDto.required ?? [])]).toEqual(['clientId']);
    const keys = Object.keys(s.PublicAuthClientSessionResponseDto.properties ?? {});
    expect(keys).toEqual(['clientId']);
    expect(keys.some((k) => /token|secret|password/i.test(k))).toBe(false);
    // Cookie names live in the description, never as a schema property.
    const clientId = s.PublicAuthClientSessionResponseDto.properties?.clientId as SchemaObject | undefined;
    expect(String(clientId?.description)).toContain('client_access_token');
    expect(String(clientId?.description)).toContain('client_refresh_token');
  });

  it('documents the public invoice with numeric halalas and a payments array', async () => {
    const s = await buildSchemas();
    const props = s.PublicInvoiceResponseDto.properties ?? {};
    // `mapInvoiceResult` maps every Prisma Decimal with `Number()`, and the
    // merged client-surface DTO documents the same projection as `number`.
    for (const key of ['subtotal', 'discountAmt', 'vatAmt', 'total', 'refundedAmount', 'refundedVatAmt', 'vatRate']) {
      expect(props[key]).toMatchObject({ type: 'number' });
    }
    expect(props.payments).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PublicInvoicePaymentDto' },
    });
    expect(props.pdfUrl).toMatchObject({ type: 'string', nullable: true });
    expect([...(s.PublicInvoiceResponseDto.required ?? [])].sort()).toEqual(
      [
        'bookingId', 'branchId', 'clientId', 'createdAt', 'currency', 'discountAmt', 'dueAt',
        'employeeId', 'id', 'issuedAt', 'number', 'packagePurchaseId', 'paidAt', 'payments',
        'pdfUrl', 'refundedAmount', 'refundedVatAmt', 'sellerName', 'status', 'subtotal', 'total',
        'vatAmt', 'vatRate',
      ].sort(),
    );
  });

  it('documents the booking invoice without a number or payments array', async () => {
    const s = await buildSchemas();
    const props = s.PublicBookingInvoiceResponseDto.properties ?? {};
    expect(props).not.toHaveProperty('number');
    expect(props).not.toHaveProperty('payments');
    expect(props.pdfUrl).toMatchObject({ type: 'string', nullable: true });
    expect(s.PublicInvoicePdfUrlDto.required).toEqual(['url']);
  });

  it('documents the refund request and both webhook acknowledgements', async () => {
    const s = await buildSchemas();
    expect(s.PublicRefundRequestResponseDto.properties?.amount).toMatchObject({ type: 'integer', minimum: 0 });
    expect([...(s.PublicRefundRequestResponseDto.required ?? [])].sort()).toEqual(
      ['amount', 'createdAt', 'id', 'status'],
    );

    expect(s.PublicPaymentWebhookAckDto.required).toBeUndefined();
    expect(s.PublicPaymentWebhookAckDto.properties?.skipped).toMatchObject({ type: 'boolean' });
    expect(s.PublicPaymentWebhookAckDto.properties?.reason).toMatchObject({ type: 'string' });
    const reason = s.PublicPaymentWebhookAckDto.properties?.reason as SchemaObject | undefined;
    expect(String(reason?.description)).toContain('invalid_signature');

    expect(s.SmsWebhookDeliveryReceiptAckDto.required).toBeUndefined();
    expect(s.SmsWebhookDeliveryReceiptAckDto.properties?.skipped).toMatchObject({ type: 'boolean' });
    const ackKeys = Object.keys(s.SmsWebhookDeliveryReceiptAckDto.properties ?? {});
    expect(ackKeys.some((k) => /signature|secret|token/i.test(k))).toBe(false);
  });

  it('documents the client-chat projections with no guest credential fields', async () => {
    const s = await buildSchemas();
    const convKeys = Object.keys(s.PublicClientChatConversationDto.properties ?? {});
    expect(convKeys.sort()).toEqual(
      ['clientId', 'createdAt', 'employeeId', 'id', 'isAiChat', 'language', 'status', 'updatedAt'].sort(),
    );
    expect(convKeys.some((k) => /token|hash|guestPhone|guestName/i.test(k))).toBe(false);

    expect(s.PublicClientChatMessageDto.properties?.kind).toMatchObject({
      enum: ['TEXT', 'ACTION_CARD', 'OPERATION_RESULT', 'SYSTEM_EVENT'],
    });
    expect(s.PublicClientChatMessageDto.properties?.metadata).toMatchObject({
      oneOf: expect.arrayContaining([
        { $ref: '#/components/schemas/PublicClientChatOperationCardMetadataDto' },
      ]),
    });
    expect(s.PublicClientChatMessagePageDto.properties?.data).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PublicClientChatMessageDto' },
    });
    expect(s.PublicClientChatMessageCursorMetaDto.properties?.limit).toMatchObject({
      type: 'integer', minimum: 1, maximum: 100,
    });
    for (const key of ['version', 'requiredConfirmations', 'confirmationCount']) {
      expect(s.PublicClientChatOperationDto.properties?.[key]).toMatchObject({ type: 'integer', minimum: 0 });
    }
  });
});
