import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { Booking, FcmToken, Notification, Rating } from '@prisma/client';

import {
  ClientBookingInvoiceResponseDto,
  ClientBookingJoinResponseDto,
  ClientBookingMutationDto,
  ClientBookingRatingResponseDto,
  ClientBookingRecordDto,
  ClientBookingRescheduleResponseDto,
} from './client-booking-response.dto';
import {
  ClientChatAssistantRecoveryMetadataDto,
  ClientChatConversationDto,
  ClientChatHandoffMetadataDto,
  ClientChatMessageDto,
  ClientChatMessagePageDto,
  ClientChatMessagePageMetaDto,
  ClientChatOperationCardMetadataDto,
  ClientChatOperationDto,
  ClientChatOperationResultMetadataDto,
} from './client-chat-response.dto';
import {
  ClientInvoiceDto,
  ClientInvoiceListItemDto,
  ClientInvoiceListResponseDto,
  ClientInvoicePaymentDto,
  ClientInvoicePdfUrlDto,
} from './client-invoice-response.dto';
import {
  ClientNotificationFcmTokenDto,
  ClientNotificationPageDto,
  ClientNotificationUnreadCountDto,
} from './client-notification-response.dto';
import {
  ClientPackageCreditDto,
  ClientPackagePurchaseDto,
} from './client-package-response.dto';
import { ClientPaymentRecordDto } from './client-payment-response.dto';
import { ClientRefundRequestResponseDto } from './client-refund-response.dto';
import { HealthCheckResultDto, HealthLivenessResponseDto } from '../../../common/swagger/health-response.dto';

import { ClientBookingsController } from '../bookings.controller';
import { ClientChatController } from '../chat.controller';
import { ClientInvoicesController } from '../invoices.controller';
import { ClientNotificationsController } from '../notifications.controller';
import { ClientPackagesController } from '../packages.controller';
import { ClientPaymentsController } from '../payments.controller';
import { ClientRefundsController } from '../refunds.controller';
import { PublicHealthController } from '../../public/health.controller';

import type { GetClientBookingForActionHandler } from '../../../modules/bookings/client/get-client-booking-for-action.handler';
import type { ClientRescheduleBookingHandler } from '../../../modules/bookings/client/client-reschedule-booking.handler';
import type { SubmitRatingHandler } from '../../../modules/org-experience/ratings/submit-rating.handler';
import type { GetBookingInvoiceHandler } from '../../../modules/finance/get-invoice/get-booking-invoice.handler';
import type { GetPublicInvoiceHandler } from '../../../modules/finance/get-invoice/get-public-invoice.handler';
import type { ListClientInvoicesHandler } from '../../../modules/finance/list-client-invoices/list-client-invoices.handler';
import type { ListClientChatConversationsHandler } from '../../../modules/comms/chat/messages/list-client-chat-conversations.handler';
import type {
  ClientChatConversationDetailDto,
  ListClientChatConversationsResponseDto,
} from '../../../modules/comms/chat/messages/list-client-chat-conversations.dto';
import type { GetClientChatConversationHandler } from '../../../modules/comms/chat/messages/get-client-chat-conversation.handler';
import type { ListChatMessagesHandler } from '../../../modules/comms/chat/messages/list-chat-messages.handler';
import type { GetCurrentConversationHandler } from '../../../modules/comms/chat/guest/get-current-conversation.handler';
import type { GetUnreadCountHandler } from '../../../modules/comms/notifications/get-unread-count.handler';
import type { RegisterFcmTokenHandler } from '../../../modules/comms/fcm-tokens/register-fcm-token.handler';
import type { ListClientPackagePurchasesHandler } from '../../../modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import type { RequestRefundHandler } from '../../../modules/finance/refund-payment/request-refund.handler';
import type { HealthCheckResult } from '../../../modules/ops/health-check/health-check.handler';
import type { ChatMessageResponse } from '../../../modules/comms/chat/messages/chat-message.mapper';
import type { PublicChatOperation } from '../../../modules/comms/chat/operations/chat-operation-public.mapper';
import type { toChatConversationResponse } from '../../../modules/comms/chat/guest/chat-conversation.response';
import type { ListChatMessagesResult } from '../../../modules/comms/chat/messages/list-chat-messages.handler';
import type { ClientPage } from '../client-page';
import { projectClientBookingMutation } from '../../../modules/bookings/client/client-booking-mutation.projection';

// ── Compile-time exactness: DTO <=> INFERRED producer output ────────────────
//
// Nothing under src/modules imports this layer (see the deliverable grep). Each
// assertion below reads the producer's INFERRED type, so it proves both that
// the DTO covers what the route really returns and that it documents nothing
// the route never returns. Negative controls at the bottom prove the equality
// helper is not vacuous.

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

// ── Bookings ───────────────────────────────────────────────────────────────

type JoinBooking = Awaited<ReturnType<GetClientBookingForActionHandler['executeForJoin']>>;
/** Join is composed by the controller from the action probe. */
export type JoinMatches = Expect<
  Equal<Pick<JoinBooking, 'zoomJoinUrl' | 'scheduledAt'>, { zoomJoinUrl: string | null; scheduledAt: Date }>
>;
export type JoinDtoKeys = Expect<Equal<keyof ClientBookingJoinResponseDto, 'joinUrl' | 'scheduledAt'>>;
export type RatingMatches = Expect<Equal<Result<SubmitRatingHandler, 'execute'>, ClientBookingRatingResponseDto>>;
/** The rating DTO lists exactly the columns of the Prisma row. */
export type RatingDtoMatchesPrismaRow = Expect<Equal<ClientBookingRatingResponseDto, Rating>>;

/** The projection's runtime allow-list, copied from CLIENT_MUTATION_FIELDS. */
const MUTATION_WIRE_KEYS = [
  'id', 'bookingNumber', 'serviceId', 'employeeId', 'branchId', 'status', 'bookingType',
  'deliveryType', 'scheduledAt', 'endsAt', 'durationMins', 'durationMinutesSnapshot', 'price',
  'priceSnapshot', 'currency', 'payAtClinic', 'serviceNameSnapshot', 'employeeNameSnapshot',
  'branchNameSnapshot', 'categoryNameSnapshot', 'zoomJoinUrl', 'zoomMeetingStatus', 'createdAt',
  'updatedAt', 'checkedInAt', 'confirmedAt', 'completedAt', 'noShowAt', 'cancelledAt', 'cancelReason',
] as const;
type MutationWireKey = (typeof MUTATION_WIRE_KEYS)[number];
type MutatedBooking = ReturnType<typeof projectClientBookingMutation>;
/** The mutation DTO documents exactly the projection's allow-list (no extra key). */
export type MutationAddsNoKey = Expect<Equal<Exclude<keyof ClientBookingMutationDto, MutationWireKey>, never>>;
/** …and nothing the projection copies is missing from the DTO. */
export type MutationDropsNoKey = Expect<Equal<Exclude<MutationWireKey, keyof ClientBookingMutationDto>, never>>;
/** The projection is declared Partial<Booking>, so it may only carry Booking columns. */
export type MutationProjectsOnlyBookingKeys = Expect<Equal<Exclude<MutationWireKey, keyof Booking>, never>>;
/** Each field keeps the domain column's type (Decimal stays a Decimal → string on the wire). */
export type MutationFieldTypes = Expect<Equal<
  Pick<ClientBookingMutationDto, keyof Booking & keyof ClientBookingMutationDto>,
  Pick<Booking, keyof Booking & keyof ClientBookingMutationDto>
>>;
export type RescheduleMatches = Expect<
  Equal<ClientBookingRescheduleResponseDto, { booking: ClientBookingMutationDto }>
>;
/** `POST /client/packages/book` returns the raw Booking row. */
export type PackageBookRecordMatchesRow = Expect<Equal<ClientBookingRecordDto, Booking>>;

type BookingInvoice = Awaited<ReturnType<GetBookingInvoiceHandler['execute']>>;
export type BookingInvoiceMatches = Expect<
  Equal<ClientBookingInvoiceResponseDto, Omit<BookingInvoice, 'pdfUrl'> & { hasReceipt: boolean }>
>;
export type BookingInvoiceDropsPdfKey = Expect<Equal<Extract<'pdfUrl', keyof ClientBookingInvoiceResponseDto>, never>>;

// ── Invoices ───────────────────────────────────────────────────────────────

type ClientInvoiceDetail = Awaited<ReturnType<GetPublicInvoiceHandler['execute']>>;
export type InvoiceDetailMatches = Expect<
  Equal<ClientInvoiceDto, Omit<ClientInvoiceDetail, 'pdfUrl'> & { hasReceipt: boolean }>
>;
export type InvoicePaymentMatches = Expect<Equal<ClientInvoicePaymentDto, ClientInvoiceDetail['payments'][number]>>;

type InvoiceList = Awaited<ReturnType<ListClientInvoicesHandler['execute']>>;
export type InvoiceListMatches = Expect<Equal<ClientInvoiceListResponseDto, InvoiceList>>;
export type InvoiceListRowMatches = Expect<Equal<ClientInvoiceListItemDto, InvoiceList['items'][number]>>;
export type InvoicePdfMatches = Expect<Equal<ClientInvoicePdfUrlDto, { url: string }>>;

// ── Notifications ──────────────────────────────────────────────────────────

export type UnreadCountMatches = Expect<Equal<Result<GetUnreadCountHandler, 'execute'>, ClientNotificationUnreadCountDto>>;
export type FcmTokenMatches = Expect<
  Equal<Result<RegisterFcmTokenHandler, 'execute'>, ClientNotificationFcmTokenDto>
>;
export type FcmTokenMatchesRow = Expect<Equal<ClientNotificationFcmTokenDto, FcmToken>>;
export type NotificationPageMatches = Expect<Equal<ClientNotificationPageDto, ClientPage<Notification>>>;

// ── Packages ───────────────────────────────────────────────────────────────

type Purchases = Awaited<ReturnType<ListClientPackagePurchasesHandler['execute']>>;
export type PurchaseMatches = Expect<Equal<ClientPackagePurchaseDto, Omit<Purchases[number], 'notes'>>>;
export type PurchaseCreditMatches = Expect<Equal<ClientPackageCreditDto, Purchases[number]['credits'][number]>>;

// ── Payments and refunds ───────────────────────────────────────────────────

/** `ClientPaymentRecordDto` is the raw `Payment` row (the subclass adds no key). */
export type PaymentRecordKeys = Expect<Equal<keyof ClientPaymentRecordDto, keyof ClientPaymentRecordDto extends never ? never : keyof import('@prisma/client').Payment>>;
export type RefundMatches = Expect<Equal<Result<RequestRefundHandler, 'execute'>, ClientRefundRequestResponseDto>>;

// ── Chat ───────────────────────────────────────────────────────────────────

export type ConversationMatches = Expect<Equal<ClientChatConversationDto, ReturnType<typeof toChatConversationResponse>>>;
export type MessageMatches = Expect<Equal<ClientChatMessageDto, ChatMessageResponse>>;
export type MessagePageMatches = Expect<Equal<ClientChatMessagePageDto, ListChatMessagesResult>>;
export type OperationMatches = Expect<Equal<ClientChatOperationDto, PublicChatOperation>>;
export type OperationCardMetadataMatches = Expect<
  Equal<ClientChatOperationCardMetadataDto, { action: 'CHAT_OPERATION'; operation: PublicChatOperation }>
>;
export type HandoffMetadataMatches = Expect<
  Equal<ClientChatHandoffMetadataDto, { action: 'OFFER_HANDOFF'; reason: 'OUT_OF_SCOPE' | 'USER_REQUESTED' | 'LIMIT_REACHED' }>
>;
export type RecoveryMetadataMatches = Expect<
  Equal<ClientChatAssistantRecoveryMetadataDto, { action: 'ASSISTANT_RECOVERY'; canRetry: boolean }>
>;
export type OperationResultMetadataMatches = Expect<
  Equal<ClientChatOperationResultMetadataDto, NonNullable<ChatMessageResponse['metadata']> extends infer M
    ? M extends { operationId: string } ? M : never
    : never>
>;
/** Only a client-owned conversation can be returned by the current/handoff routes. */
export type CurrentMatches = Expect<
  Equal<ClientChatConversationDto, Result<GetCurrentConversationHandler, 'execute'>>
>;
/** `GET /client/chat/conversations` is documented by the module DTO; pin it to the handler. */
type ConversationList = Awaited<ReturnType<ListClientChatConversationsHandler['execute']>>;
export type ConversationListRows = Expect<
  Equal<ConversationList['data'], ListClientChatConversationsResponseDto['data']>
>;
export type ConversationListMeta = Expect<
  Equal<ConversationList['meta'], ListClientChatConversationsResponseDto['meta']>
>;
/** `GET /client/chat/conversations/:id` likewise. */
type ConversationDetail = Awaited<ReturnType<GetClientChatConversationHandler['execute']>>;
export type ConversationDetailMatches = Expect<Equal<ConversationDetail, ClientChatConversationDetailDto>>;

// ── Health ─────────────────────────────────────────────────────────────────

export type HealthMatches = Expect<Equal<HealthCheckResultDto, HealthCheckResult>>;
export type LivenessMatches = Expect<Equal<HealthLivenessResponseDto, ReturnType<PublicHealthController['getLiveness']>>>;

// ── Negative controls: the equality helper is not vacuous ──────────────────

type RateResult = Result<SubmitRatingHandler, 'execute'>;
type N_extraKey = Equal<RateResult, ClientBookingRatingResponseDto & { extra: 1 }>;
type N_missingKey = Equal<RateResult, Omit<ClientBookingRatingResponseDto, 'bookingId'>>;
type N_changedType = Equal<RateResult, Omit<ClientBookingRatingResponseDto, 'score'> & { score: string }>;
type N_optionality = Equal<RateResult, Omit<ClientBookingRatingResponseDto, 'comment'> & { comment?: string | null }>;
type N_wrongRoute = Equal<Result<GetUnreadCountHandler, 'execute'>, ClientBookingRatingResponseDto>;
type N_nestedDrift = Equal<ClientChatMessagePageDto, Omit<ClientChatMessagePageDto, 'meta'> & { meta: { limit: number; nextCursor: string | null } }>;
type N_nestedElement = Equal<ClientInvoiceListResponseDto, Omit<ClientInvoiceListResponseDto, 'items'> & { items: Omit<ClientInvoiceListItemDto, 'paymentStatus'>[] }>;
type N_decimalAsNumber = Equal<ClientBookingMutationDto, Omit<ClientBookingMutationDto, 'price'> & { price: number }>;

export type ControlsReject = Expect<
  [N_extraKey, N_missingKey, N_changedType, N_optionality, N_wrongRoute, N_nestedDrift, N_nestedElement, N_decimalAsNumber] extends
    [false, false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level assertions (what the snapshot will say) ────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        ClientBookingJoinResponseDto,
        ClientBookingRatingResponseDto,
        ClientBookingMutationDto,
        ClientBookingRescheduleResponseDto,
        ClientBookingInvoiceResponseDto,
        ClientBookingRecordDto,
        ClientInvoiceDto,
        ClientInvoiceListItemDto,
        ClientInvoiceListResponseDto,
        ClientInvoicePaymentDto,
        ClientInvoicePdfUrlDto,
        ClientNotificationPageDto,
        ClientNotificationUnreadCountDto,
        ClientNotificationFcmTokenDto,
        ClientPackageCreditDto,
        ClientPackagePurchaseDto,
        ClientPaymentRecordDto,
        ClientRefundRequestResponseDto,
        ClientChatConversationDto,
        ClientChatMessageDto,
        ClientChatMessagePageDto,
        ClientChatMessagePageMetaDto,
        ClientChatOperationDto,
        ClientChatOperationCardMetadataDto,
        ClientChatHandoffMetadataDto,
        ClientChatAssistantRecoveryMetadataDto,
        ClientChatOperationResultMetadataDto,
        HealthLivenessResponseDto,
        HealthCheckResultDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('client surface response schemas', () => {
  it('documents the join payload as a nullable URL plus the scheduled time', async () => {
    const s = await buildSchemas();
    expect([...(s.ClientBookingJoinResponseDto.required ?? [])].sort()).toEqual(['joinUrl', 'scheduledAt']);
    expect(s.ClientBookingJoinResponseDto.properties?.joinUrl).toMatchObject({ type: 'string', nullable: true });
    expect(s.ClientBookingJoinResponseDto.properties?.scheduledAt).toMatchObject({ type: 'string', format: 'date-time' });
  });

  it('documents the rating score bounds and the client DTO', async () => {
    const s = await buildSchemas();
    expect(s.ClientBookingRatingResponseDto.properties?.score).toMatchObject({ type: 'integer', minimum: 1, maximum: 5 });
    expect([...(s.ClientBookingRatingResponseDto.required ?? [])].sort()).toEqual(
      ['bookingId', 'clientId', 'comment', 'createdAt', 'employeeId', 'id', 'isPublic', 'score'],
    );
  });

  it('keeps Decimal booking money as a decimal string, never a number', async () => {
    const s = await buildSchemas();
    expect(s.ClientBookingMutationDto.properties?.price).toMatchObject({ type: 'string' });
    expect(s.ClientBookingMutationDto.properties?.priceSnapshot).toMatchObject({ type: 'string', nullable: true });
  });

  it('documents the client invoice with integer halalas and a hasReceipt flag', async () => {
    const s = await buildSchemas();
    const props = s.ClientInvoiceDto.properties ?? {};
    expect(props.hasReceipt).toMatchObject({ type: 'boolean' });
    expect(props.total).toMatchObject({ type: 'number' });
    expect(props.payments).toMatchObject({ type: 'array', items: { $ref: '#/components/schemas/ClientInvoicePaymentDto' } });
    expect(s.ClientInvoiceDto.required).not.toContain('pdfUrl');
    expect(s.ClientInvoiceDto.required).toContain('hasReceipt');

    expect(s.ClientInvoiceListResponseDto.properties?.outstandingBalance).toMatchObject({ type: 'integer', minimum: 0 });
    expect(s.ClientInvoiceListResponseDto.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ClientInvoiceListItemDto' },
    });
    expect(s.ClientInvoicePdfUrlDto.properties?.url).toMatchObject({ type: 'string' });
    expect(s.ClientInvoicePdfUrlDto.required).toEqual(['url']);
  });

  it('documents the booking-scoped invoice without an invoice number or payments', async () => {
    const s = await buildSchemas();
    const props = s.ClientBookingInvoiceResponseDto.properties ?? {};
    expect(props.hasReceipt).toMatchObject({ type: 'boolean' });
    expect(props).not.toHaveProperty('number');
    expect(props).not.toHaveProperty('payments');
    expect(props).not.toHaveProperty('pdfUrl');
  });

  it('documents the notification page envelope, unread count and FCM row', async () => {
    const s = await buildSchemas();
    expect([...(s.ClientNotificationPageDto.required ?? [])].sort()).toEqual(
      ['items', 'page', 'pageSize', 'total'],
    );
    expect(s.ClientNotificationPageDto.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/NotificationResponseDto' },
    });
    expect(s.ClientNotificationUnreadCountDto.properties?.count).toMatchObject({ type: 'integer', minimum: 0 });
    expect(s.ClientNotificationFcmTokenDto.required).toContain('token');
  });

  it('documents package credits as integer counts and integer-halalas money', async () => {
    const s = await buildSchemas();
    expect(s.ClientPackageCreditDto.properties?.remaining).toMatchObject({ type: 'integer' });
    expect(s.ClientPackageCreditDto.properties?.totalQuantity).toMatchObject({ type: 'integer' });
    expect(s.ClientPackageCreditDto.properties?.amountPaid).toBeUndefined();
    expect(s.ClientPackagePurchaseDto.properties?.amountPaid).toMatchObject({ type: 'number' });
    expect(s.ClientPackagePurchaseDto.properties?.vatAmount).toMatchObject({ type: 'number' });
    expect(s.ClientPackagePurchaseDto.required ?? []).not.toContain('notes');
    expect(s.ClientPackagePurchaseDto.required ?? []).not.toContain('invoiceId');
  });

  it('documents the bank-transfer payment row with decimal-string money', async () => {
    const s = await buildSchemas();
    expect(s.ClientPaymentRecordDto.properties?.amount).toMatchObject({ type: 'string' });
    expect(s.ClientPaymentRecordDto.properties?.refundedAmount).toMatchObject({ type: 'string' });
    // `status`/`method` carry the enum through `allOf` refs to the shared
    // PaymentStatus/PaymentMethod schemas, so only `nullable` is inline.
    expect(s.ClientPaymentRecordDto.properties?.status).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/PaymentStatus' }],
    });
    expect(s.PaymentStatus.enum).toEqual(expect.arrayContaining(['PENDING_VERIFICATION']));
  });

  it('documents the refund request response as integer halalas', async () => {
    const s = await buildSchemas();
    expect(s.ClientRefundRequestResponseDto.properties?.amount).toMatchObject({ type: 'integer', minimum: 0 });
    expect([...(s.ClientRefundRequestResponseDto.required ?? [])].sort()).toEqual(
      ['amount', 'createdAt', 'id', 'status'],
    );
  });

  it('documents the chat projections: nullable identities, sanitized summary, paginated messages', async () => {
    const s = await buildSchemas();
    const conversation = s.ClientChatConversationDto.properties ?? {};
    expect(conversation.clientId).toMatchObject({ type: 'string', nullable: true });
    expect(conversation.employeeId).toMatchObject({ type: 'string', nullable: true });
    // Both identities are always present on the wire (possibly null), so they
    // stay required while allowing null.
    expect([...(s.ClientChatConversationDto.required ?? [])].sort()).toEqual(
      ['clientId', 'createdAt', 'employeeId', 'id', 'isAiChat', 'language', 'status', 'updatedAt'],
    );

    const operation = s.ClientChatOperationDto.properties ?? {};
    // Enum carried via an `allOf` ref to the shared ChatOperationStatus schema.
    expect(operation.status).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/ChatOperationStatus' }],
    });
    expect(s.ChatOperationStatus.enum).toEqual(
      expect.arrayContaining(['AWAITING_CONFIRMATION', 'SUCCEEDED', 'DECLINED']),
    );
    expect(operation.version).toMatchObject({ type: 'integer', minimum: 0 });
    expect(operation.summary).toMatchObject({ type: 'object', additionalProperties: true });

    const message = s.ClientChatMessageDto.properties ?? {};
    expect(message.metadata).toMatchObject({ oneOf: expect.arrayContaining([
      { $ref: '#/components/schemas/ClientChatOperationCardMetadataDto' },
    ]) });
    expect(s.ClientChatMessagePageDto.properties?.data).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ClientChatMessageDto' },
    });
    expect([...(s.ClientChatMessagePageDto.required ?? [])].sort()).toEqual(['data', 'meta']);
    expect([...(s.ClientChatMessagePageMetaDto.required ?? [])].sort()).toEqual(
      ['hasMore', 'limit', 'nextCursor'],
    );
  });

  it('documents the health payloads and their per-indicator maps', async () => {
    const s = await buildSchemas();
    expect([...(s.HealthLivenessResponseDto.required ?? [])].sort()).toEqual(
      ['gitSha', 'status', 'timestamp', 'version'],
    );
    expect(s.HealthLivenessResponseDto.properties?.status).toMatchObject({ enum: ['ok'] });
    expect(s.HealthCheckResultDto.properties?.status).toMatchObject({ enum: ['ok', 'error'] });
    expect(s.HealthCheckResultDto.properties?.info).toMatchObject({
      type: 'object',
      additionalProperties: { $ref: '#/components/schemas/HealthIndicatorResultDto' },
    });
    expect([...(s.HealthCheckResultDto.required ?? [])].sort()).toEqual(
      ['details', 'error', 'gitSha', 'info', 'status', 'version'],
    );
  });

  it('pins the exact runtime allow-list of the mutation projection', () => {
    // A Booking row with every column populated: `projectClientBookingMutation`
    // copies only CLIENT_MUTATION_FIELDS, so the surviving keys ARE the wire
    // contract this DTO documents.
    const row = {
      id: 'b', branchId: 'br', clientId: 'c', employeeId: 'e', serviceId: 's',
      bookingType: 'INDIVIDUAL', deliveryType: 'IN_PERSON', source: 'ONLINE',
      creationIdempotencyKey: null, creationRequestHash: null, status: 'CONFIRMED',
      isHistoricalImport: false, lateEntryRecordedAt: null, lateEntryRecordedBy: null,
      scheduledAt: new Date(), endsAt: new Date(), durationMins: 60, price: '0', currency: 'SAR',
      notes: 'staff-private', cancelReason: null, cancelNotes: 'private', cancelledAt: null,
      confirmedAt: null, checkedInAt: null, autoNoShowSuppressedAt: null, completedAt: null,
      noShowAt: null, expiresAt: null, durationOptionId: null, programId: null,
      packageCreditId: null, payAtClinic: false, couponCode: null, discountedPrice: null,
      zoomMeetingId: null, zoomJoinUrl: null, zoomHostUrl: 'host-secret', zoomStartUrl: 'start-secret',
      zoomMeetingStatus: null, zoomMeetingError: 'private', zoomMeetingCreatedAt: null,
      zoomCreatePhase: 'BEFORE_CALL', zoomCreateLeaseOwner: null, zoomCreateLeaseExpiresAt: null,
      zoomCreateAttemptCount: 0, zoomSyncRevision: 0, zoomSyncLeaseOwner: null,
      zoomSyncLeaseExpiresAt: null, priceSnapshot: null, durationMinutesSnapshot: null,
      branchNameSnapshot: null, employeeNameSnapshot: null, serviceNameSnapshot: null,
      categoryNameSnapshot: null, departmentNameSnapshot: null, bookingNumber: 1,
      createdAt: new Date(), updatedAt: new Date(),
    } as unknown as Booking;

    const projected = projectClientBookingMutation(row);
    const documented = new Set([
      'id', 'bookingNumber', 'serviceId', 'employeeId', 'branchId', 'status', 'bookingType',
      'deliveryType', 'scheduledAt', 'endsAt', 'durationMins', 'durationMinutesSnapshot', 'price',
      'priceSnapshot', 'currency', 'payAtClinic', 'serviceNameSnapshot', 'employeeNameSnapshot',
      'branchNameSnapshot', 'categoryNameSnapshot', 'zoomJoinUrl', 'zoomMeetingStatus', 'createdAt',
      'updatedAt', 'checkedInAt', 'confirmedAt', 'completedAt', 'noShowAt', 'cancelledAt', 'cancelReason',
    ]);
    expect(Object.keys(projected).sort()).toEqual([...documented].sort());
    for (const leaked of ['notes', 'zoomHostUrl', 'zoomStartUrl', 'zoomMeetingError', 'source', 'clientId']) {
      expect(projected).not.toHaveProperty(leaked);
    }
  });

  it('never returns the receipt storage key on a client invoice route', async () => {
    const s = await buildSchemas();
    for (const name of ['ClientInvoiceDto', 'ClientBookingInvoiceResponseDto']) {
      expect(Object.keys(s[name].properties ?? {})).not.toContain('pdfUrl');
    }
  });
});
