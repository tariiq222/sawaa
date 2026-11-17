import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import {
  MobileAuthEmailVerificationSentDto,
  MobileAuthLoginOtpSentDto,
  MobileAuthRegisteredUserDto,
  MobileAuthTokenPairDto,
} from './mobile-auth-response.dto';
import {
  MobileBookingRecordDto,
  MobileCancelledBookingRecordDto,
  MobileCreatedBookingRecordDto,
  MobileFcmTokenRecordDto,
  MobilePaymentRecordDto,
} from './dto/mobile-record-response.dto';
import {
  MobileClientBookingJoinDto,
  MobileClientBookingMutationDto,
  MobileClientRatingResponseDto,
  MobileClientRescheduleResponseDto,
} from './client/dto/mobile-client-bookings-response.dto';
import {
  MobileClientPackageCreditDto,
  MobileClientPackagePurchaseDto,
} from './client/dto/mobile-client-packages-response.dto';
import {
  MobileClientInvoiceDto,
  MobileClientPaymentDto,
  MobileClientPaymentInvoiceSummaryDto,
  MobileClientPaymentListResponseDto,
} from './client/dto/mobile-client-payments-response.dto';
import {
  MobileEmployeeBookingListResponseDto,
  MobileEmployeeBookingRowDto,
  MobileEmployeeMeetingStartDto,
} from './employee/dto/mobile-employee-bookings-response.dto';

import type { NativeRefreshHandler } from '../../modules/identity/native-session/native-refresh.handler';
import type { RegisterMobileUserHandler } from '../../modules/identity/register-mobile-user/register-mobile-user.handler';
import type { RequestEmailVerificationHandler } from '../../modules/identity/request-email-verification/request-email-verification.handler';
import type { RequestMobileLoginOtpHandler } from '../../modules/identity/request-mobile-login-otp/request-mobile-login-otp.handler';
import type { GetClientBookingForActionHandler } from '../../modules/bookings/client/get-client-booking-for-action.handler';
import type { SubmitRatingHandler } from '../../modules/org-experience/ratings/submit-rating.handler';

// ── Compile-time exactness: DTO <=> INFERRED handler output ────────────────
//
// The controllers annotate `Promise<Dto>`, which proves the handler fits the
// DTO. These assertions also prove the DTO documents nothing the handler never
// produces. Nothing under `src/modules` imports from this layer: every import
// above is `import type`, so the handlers stay INFERRED. The negative controls
// at the bottom prove the equality helper is not vacuous.

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

// ── Mobile auth: DTO <=> handler result ────────────────────────────────────

export type RegisterMatches = Expect<Equal<Result<RegisterMobileUserHandler, 'execute'>, MobileAuthRegisteredUserDto>>;
export type RequestLoginOtpMatches = Expect<Equal<Result<RequestMobileLoginOtpHandler, 'execute'>, MobileAuthLoginOtpSentDto>>;
export type RequestEmailVerificationMatches = Expect<Equal<Result<RequestEmailVerificationHandler, 'execute'>, MobileAuthEmailVerificationSentDto>>;
export type RefreshMatches = Expect<Equal<Result<NativeRefreshHandler, 'execute'>, MobileAuthTokenPairDto>>;

// ── Mobile client bookings: join + rating ──────────────────────────────────

/** Join response is composed by the controller from the booking action probe. */
type JoinBooking = Awaited<ReturnType<GetClientBookingForActionHandler['executeForJoin']>>;
export type JoinMatches = Expect<
  Equal<Pick<JoinBooking, 'zoomJoinUrl' | 'scheduledAt'>, { zoomJoinUrl: string | null; scheduledAt: Date }>
>;
export type RateMatches = Expect<Equal<Result<SubmitRatingHandler, 'execute'>, MobileClientRatingResponseDto>>;

// ── Negative controls: the equality helper is not vacuous ──────────────────

type RefreshResult = Result<NativeRefreshHandler, 'execute'>;
type N_extraKey = Equal<RefreshResult, MobileAuthTokenPairDto & { extra: 1 }>;
type N_missingKey = Equal<RefreshResult, Omit<MobileAuthTokenPairDto, 'refreshToken'>>;
type N_changedType = Equal<RefreshResult, Omit<MobileAuthTokenPairDto, 'accessToken'> & { accessToken: number }>;
type N_optionality = Equal<RefreshResult, Omit<MobileAuthTokenPairDto, 'refreshToken'> & { refreshToken?: string }>;
type N_wrongRoute = Equal<Result<RequestEmailVerificationHandler, 'execute'>, MobileAuthLoginOtpSentDto>;
type N_nestedArray = Equal<Result<SubmitRatingHandler, 'execute'>, Omit<MobileClientRatingResponseDto, 'id'>>;

export type ControlsReject = Expect<
  [N_extraKey, N_missingKey, N_changedType, N_optionality, N_wrongRoute, N_nestedArray] extends
    [false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        MobileAuthTokenPairDto,
        MobileAuthRegisteredUserDto,
        MobileAuthEmailVerificationSentDto,
        MobileAuthLoginOtpSentDto,
        MobileClientBookingJoinDto,
        MobileClientRatingResponseDto,
        MobileClientBookingMutationDto,
        MobileClientRescheduleResponseDto,
        MobileClientPackageCreditDto,
        MobileClientPackagePurchaseDto,
        MobileClientPaymentDto,
        MobileClientPaymentInvoiceSummaryDto,
        MobileClientPaymentListResponseDto,
        MobileClientInvoiceDto,
        MobileEmployeeBookingRowDto,
        MobileEmployeeBookingListResponseDto,
        MobileEmployeeMeetingStartDto,
        MobileBookingRecordDto,
        MobileCreatedBookingRecordDto,
        MobileCancelledBookingRecordDto,
        MobilePaymentRecordDto,
        MobileFcmTokenRecordDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('mobile response schemas (output shape)', () => {
  it('documents the native refresh token pair', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.MobileAuthTokenPairDto.required ?? [])].sort()).toEqual(
      ['accessToken', 'refreshToken'].sort(),
    );
    expect(schemas.MobileAuthTokenPairDto.properties?.accessToken).toMatchObject({ type: 'string' });
  });

  it('documents the booking join payload as a nullable URL plus the scheduled time', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.MobileClientBookingJoinDto.required ?? [])].sort()).toEqual(
      ['joinUrl', 'scheduledAt'].sort(),
    );
    expect(schemas.MobileClientBookingJoinDto.properties?.joinUrl).toMatchObject({ type: 'string', nullable: true });
    expect(schemas.MobileClientBookingJoinDto.properties?.scheduledAt).toMatchObject({ type: 'string', format: 'date-time' });
  });

  it('documents the rating score bounds', async () => {
    const schemas = await buildSchemas();
    expect(schemas.MobileClientRatingResponseDto.properties?.score).toMatchObject({ type: 'integer', minimum: 1, maximum: 5 });
    expect([...(schemas.MobileClientRatingResponseDto.required ?? [])].sort()).toEqual(
      ['bookingId', 'clientId', 'comment', 'createdAt', 'employeeId', 'id', 'isPublic', 'score'].sort(),
    );
  });

  it('keeps Decimal booking money as a decimal string, never a number', async () => {
    const schemas = await buildSchemas();
    expect(schemas.MobileClientBookingMutationDto.properties?.price).toMatchObject({ type: 'string' });
    expect(schemas.MobileClientBookingMutationDto.properties?.priceSnapshot).toMatchObject({ type: 'string', nullable: true });
    expect(schemas.MobilePaymentRecordDto.properties?.amount).toMatchObject({ type: 'string' });
    expect(schemas.MobilePaymentRecordDto.properties?.refundedAmount).toMatchObject({ type: 'string' });
  });

  it('documents the client payment list amount as a decimal string with integer halalas kept numeric elsewhere', async () => {
    const schemas = await buildSchemas();
    expect(schemas.MobileClientPaymentDto.properties?.amount).toMatchObject({ type: 'string' });
    expect(schemas.MobileClientPaymentDto.properties?.invoice).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/MobileClientPaymentInvoiceSummaryDto' }],
    });
    expect(schemas.MobileClientPaymentInvoiceSummaryDto.properties?.total).toMatchObject({ type: 'string' });
  });

  it('documents the client invoice with its raw receipt key and payment rows', async () => {
    const schemas = await buildSchemas();
    expect(schemas.MobileClientInvoiceDto.properties?.pdfUrl).toMatchObject({ type: 'string', nullable: true });
    expect(schemas.MobileClientInvoiceDto.properties?.payments).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/MobileClientInvoicePaymentDto' },
    });
    expect(schemas.MobileClientInvoiceDto.required).toContain('number');
  });

  it('documents package credits as integer counts with decimal-string-free numeric halalas', async () => {
    const schemas = await buildSchemas();
    expect(schemas.MobileClientPackageCreditDto.properties?.remaining).toMatchObject({ type: 'integer' });
    expect(schemas.MobileClientPackageCreditDto.properties?.totalQuantity).toMatchObject({ type: 'integer' });
    expect(schemas.MobileClientPackagePurchaseDto.required ?? []).not.toContain('invoiceId');
    expect(schemas.MobileClientPackagePurchaseDto.properties?.amountPaid).toMatchObject({ type: 'number' });
  });

  it('documents the employee booking row aliases and the meeting-start payload', async () => {
    const schemas = await buildSchemas();
    const row = Object.keys(schemas.MobileEmployeeBookingRowDto.properties ?? {}).sort();
    expect(row).toContain('date');
    expect(row).toContain('startTime');
    // `meetingStatus` carries the enum via an `allOf` ref to the shared
    // `ZoomMeetingStatus` schema; only nullable is inline.
    expect(schemas.MobileEmployeeMeetingStartDto.properties?.meetingStatus).toMatchObject({
      nullable: true,
      allOf: [{ $ref: '#/components/schemas/ZoomMeetingStatus' }],
    });
    expect(schemas.ZoomMeetingStatus.enum).toEqual(['PENDING', 'CREATED', 'FAILED', 'CANCELLED']);
    expect([...(schemas.MobileEmployeeMeetingStartDto.required ?? [])].sort()).toEqual(
      ['bookingId', 'durationMins', 'meetingStatus', 'scheduledAt', 'startUrl'].sort(),
    );
  });

  it('documents the raw write records (booking / payment / fcm)', async () => {
    const schemas = await buildSchemas();
    expect(Object.keys(schemas.MobileBookingRecordDto.properties ?? {})).toContain('zoomCreatePhase');
    expect(Object.keys(schemas.MobilePaymentRecordDto.properties ?? {})).toContain('gatewayRef');
    expect(Object.keys(schemas.MobileFcmTokenRecordDto.properties ?? {}).sort()).toEqual(
      ['clientId', 'createdAt', 'id', 'lastSeenAt', 'platform', 'token'].sort(),
    );
  });
});
