import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type {
  Coupon,
  CouponRedemption,
  Invoice,
  Payment,
  RefundRequest,
  User,
} from '@prisma/client';
import {
  EnsuredInvoiceDto,
  InvoiceDetailResponseDto,
  InvoiceListResponseDto,
  InvoiceListRowDto,
  InvoicePdfUrlDto,
  InvoiceRecordDto,
} from './finance-invoice-response.dto';
import { PaymentRecordDto } from './finance-payment-record-response.dto';
import {
  PaymentCollectionPaymentDto,
  PaymentCollectionResponseDto,
  PaymentDetailInvoiceSummaryDto,
  PaymentDetailResponseDto,
  PaymentHistoricalStatsDto,
  PaymentInvoiceClientDto,
  PaymentListInvoiceSummaryDto,
  PaymentListResponseDto,
  PaymentListRowDto,
  PaymentProcessResponseDto,
  PaymentRefundRequestRowDto,
  PaymentStatsResponseDto,
} from './finance-payment-response.dto';
import {
  CouponListResponseDto,
  CouponRecordDto,
  CouponRedemptionRecordDto,
} from './finance-coupon-response.dto';
import {
  MoyasarConfigTestResponseDto,
  MoyasarConfigUpsertResponseDto,
  MoyasarConfigViewDto,
} from './finance-moyasar-response.dto';
import {
  PackagePurchaseCreditAvailabilityDto,
  PackagePurchaseCreditConstraintDto,
  PackagePurchaseCreditDto,
  PackagePurchaseListRowDto,
  PackagePurchaseRefundResponseDto,
} from './finance-package-purchase-response.dto';
import {
  RefundApprovalResponseDto,
  RefundRequestListItemDto,
  RefundRequestRecordDto,
} from './refund-response.dto';
import {
  IdentityPermissionCatalogEntryDto,
  IdentityRoleDto,
  IdentityRolePermissionDto,
  IdentityUserRecordDto,
} from './identity-response.dto';
import { DashboardFinanceController } from '../finance.controller';
import { RefundsController } from '../refunds.controller';
import { DashboardIdentityController } from '../identity.controller';
import type { ListInvoicesHandler } from '../../../modules/finance/list-invoices/list-invoices.handler';
import type { GetInvoiceHandler } from '../../../modules/finance/get-invoice/get-invoice.handler';
import type { CreateInvoiceHandler } from '../../../modules/finance/create-invoice/create-invoice.handler';
import type { GenerateInvoicePdfHandler } from '../../../modules/finance/generate-invoice-pdf/generate-invoice-pdf.handler';
import type { ProcessPaymentHandler } from '../../../modules/finance/process-payment/process-payment.handler';
import type { EnsureBookingInvoiceHandler } from '../../../modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler';
import type { ApplyInvoiceDiscountHandler } from '../../../modules/finance/apply-invoice-discount/apply-invoice-discount.handler';
import type { CollectBookingPaymentHandler } from '../../../modules/finance/collect-booking-payment/collect-booking-payment.handler';
import type { ListPaymentsHandler } from '../../../modules/finance/list-payments/list-payments.handler';
import type { GetPaymentHandler } from '../../../modules/finance/get-payment/get-payment.handler';
import type { GetPaymentStatsHandler } from '../../../modules/finance/get-payment-stats/get-payment-stats.handler';
import type { ApplyCouponHandler } from '../../../modules/finance/apply-coupon/apply-coupon.handler';
import type { ListCouponsHandler } from '../../../modules/finance/coupons/list-coupons.handler';
import type { GetCouponHandler } from '../../../modules/finance/coupons/get-coupon.handler';
import type { CreateCouponHandler } from '../../../modules/finance/coupons/create-coupon.handler';
import type { UpdateCouponHandler } from '../../../modules/finance/coupons/update-coupon.handler';
import type { DeleteCouponHandler } from '../../../modules/finance/coupons/delete-coupon.handler';
import type { RefundPaymentHandler } from '../../../modules/finance/refund-payment/refund-payment.handler';
import type { ManualRefundPaymentHandler } from '../../../modules/finance/refund-payment/manual-refund-payment.handler';
import type { VerifyPaymentHandler } from '../../../modules/finance/verify-payment/verify-payment.handler';
import type { BankTransferUploadHandler } from '../../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import type { GetMoyasarConfigHandler } from '../../../modules/finance/moyasar-config/get-moyasar-config.handler';
import type { UpsertMoyasarConfigHandler } from '../../../modules/finance/moyasar-config/upsert-moyasar-config.handler';
import type { TestMoyasarConfigHandler } from '../../../modules/finance/moyasar-config/test-moyasar-config.handler';
import type { RefundPackagePurchaseHandler } from '../../../modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler';
import type { ListClientPackagePurchasesHandler } from '../../../modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import type { ListRefundsHandler } from '../../../modules/finance/refund-payment/list-refunds.handler';
import type { ApproveRefundHandler } from '../../../modules/finance/refund-payment/approve-refund.handler';
import type { DenyRefundHandler } from '../../../modules/finance/refund-payment/deny-refund.handler';
import type { CreateUserHandler } from '../../../modules/identity/users/create-user.handler';
import type { UpdateUserHandler } from '../../../modules/identity/users/update-user.handler';
import type { UpdateUserRoleHandler } from '../../../modules/identity/users/update-user-role.handler';
import type { ListRolesHandler } from '../../../modules/identity/roles/list-roles.handler';
import type { CreateRoleHandler } from '../../../modules/identity/roles/create-role.handler';
import type { ListPermissionsHandler } from '../../../modules/identity/roles/list-permissions.handler';
import type { ListMeta } from '../../../common/dto';

// ── Compile-time exactness: DTO <=> INFERRED producer output ────────────────
//
// No handler under src/modules is annotated with a DTO type and none imports
// from this layer (enforced by `git grep -l "api/dashboard/dto" -- src/modules`).
// Every assertion below reads the producer's inferred type, so it proves BOTH
// that the DTO covers what the handler really returns and that it documents
// nothing extra.
//
// Two documented deviations are NOT type-equal and are pinned separately:
//  - `GET /identity/users` and `GET /identity/users/:id` keep the module DTO
//    (`DashboardUsersResponseDto` / `DashboardUserResponseDto`) added by an
//    earlier MNT-08 unit; the handler returns `Date` objects that Express
//    serializes to ISO strings, which is what that schema says.
//  - `POST /finance/package-purchases` is deferred (its handler returns an
//    untyped union with index signatures).

type Expect<T extends true> = T;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * Structural equality. DTO fields are classes while producers return object
 * literals or Prisma row types, so identity comparison is useless: `Norm`
 * flattens every object and array element first, then `Extends` checks
 * assignability in BOTH directions. Optionality survives because `Norm` keeps
 * a lone `undefined` in the property type, so `required` vs `optional` is still
 * a mismatch. Negative controls at the bottom prove the helper is not vacuous.
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

/** Canonical `{ items, meta }` envelope from `toListResponse`. */
type Envelope<T> = { items: T[]; meta: ListMeta };

// ── Invoices ───────────────────────────────────────────────────────────────

export type ListInvoicesMatches = Expect<Equal<Result<ListInvoicesHandler, 'execute'>, InvoiceListResponseDto>>;
export type GetInvoiceMatches = Expect<Equal<Result<GetInvoiceHandler, 'execute'>, InvoiceDetailResponseDto>>;
export type CreateInvoiceMatches = Expect<Equal<Result<CreateInvoiceHandler, 'execute'>, InvoiceRecordDto>>;
export type GenerateInvoicePdfMatches = Expect<Equal<Result<GenerateInvoicePdfHandler, 'execute'>, string>>;
/** The stored invoice row is exactly the Prisma model — no more, no less. */
export type InvoiceRecordMatchesRow = Expect<Equal<InvoiceRecordDto, Invoice>>;
export type InvoiceListRowMatchesProjection = Expect<
  Equal<InvoiceListRowDto, Result<ListInvoicesHandler, 'execute'>['items'][number]>
>;
export type InvoiceListMatchesEnvelope = Expect<Equal<InvoiceListResponseDto, Envelope<InvoiceListRowDto>>>;
export type InvoiceMetaMatchesListMeta = Expect<Equal<InvoiceListResponseDto['meta'], ListMeta>>;

/** The detail read is the row plus its payments, nothing else. */
export type InvoiceDetailAddsOnlyPayments = Expect<
  Equal<Exclude<keyof InvoiceDetailResponseDto, keyof InvoiceRecordDto>, 'payments'>
>;
export type InvoiceDetailPaymentsArePayments = Expect<
  Equal<InvoiceDetailResponseDto['payments'], PaymentRecordDto[]>
>;

// ── Payments ───────────────────────────────────────────────────────────────

export type ProcessPaymentMatches = Expect<Equal<Result<ProcessPaymentHandler, 'execute'>, PaymentProcessResponseDto>>;
export type EnsureBookingInvoiceMatches = Expect<Equal<Result<EnsureBookingInvoiceHandler, 'execute'>, EnsuredInvoiceDto>>;
export type ApplyInvoiceDiscountMatches = Expect<Equal<Result<ApplyInvoiceDiscountHandler, 'execute'>, InvoiceRecordDto>>;
export type CollectBookingPaymentMatches = Expect<Equal<Result<CollectBookingPaymentHandler, 'execute'>, PaymentCollectionResponseDto>>;
export type ListPaymentsMatches = Expect<Equal<Result<ListPaymentsHandler, 'execute'>, PaymentListResponseDto>>;
export type GetPaymentMatches = Expect<Equal<Result<GetPaymentHandler, 'execute'>, PaymentDetailResponseDto>>;
export type GetPaymentStatsMatches = Expect<Equal<Result<GetPaymentStatsHandler, 'execute'>, PaymentStatsResponseDto>>;
export type RefundPaymentMatches = Expect<Equal<Result<RefundPaymentHandler, 'execute'>, PaymentRecordDto>>;
export type ManualRefundPaymentMatches = Expect<Equal<Result<ManualRefundPaymentHandler, 'execute'>, PaymentRecordDto>>;
export type VerifyPaymentMatches = Expect<Equal<Result<VerifyPaymentHandler, 'execute'>, PaymentRecordDto>>;
export type BankTransferUploadMatches = Expect<Equal<Result<BankTransferUploadHandler, 'execute'>, PaymentRecordDto>>;

/** The payment row DTO is exactly the Prisma model. */
export type PaymentRecordMatchesRow = Expect<Equal<PaymentRecordDto, Payment>>;
export type PaymentListMatchesEnvelope = Expect<Equal<PaymentListResponseDto, Envelope<PaymentListRowDto>>>;
export type PaymentListMetaMatchesListMeta = Expect<Equal<PaymentListResponseDto['meta'], ListMeta>>;
/** List rows add only the collection date and the invoice projection. */
export type PaymentListRowAddsOnlyTwo = Expect<
  Equal<Exclude<keyof PaymentListRowDto, keyof PaymentRecordDto>, 'collectionDate' | 'invoice'>
>;
/** Detail rows add only the invoice projection and the refund requests. */
export type PaymentDetailAddsOnlyTwo = Expect<
  Equal<Exclude<keyof PaymentDetailResponseDto, keyof PaymentRecordDto>, 'invoice' | 'refundRequests'>
>;
/** The detail invoice projection is the list projection plus the invoice number. */
export type DetailInvoiceAddsOnlyNumber = Expect<
  Equal<Exclude<keyof PaymentDetailInvoiceSummaryDto, keyof PaymentListInvoiceSummaryDto>, 'number'>
>;
export type CollectionPaymentKeys = Expect<
  Equal<keyof PaymentCollectionPaymentDto, 'id' | 'amount' | 'method' | 'status'>
>;
export type StatsHistoricalKeys = Expect<
  Equal<keyof PaymentHistoricalStatsDto, 'collectedCount' | 'collectedAmount' | 'reviewCount' | 'reviewAmount'>
>;

// ── Coupons ────────────────────────────────────────────────────────────────

export type ApplyCouponMatches = Expect<Equal<Result<ApplyCouponHandler, 'execute'>, CouponRedemptionRecordDto>>;
export type ListCouponsMatches = Expect<Equal<Result<ListCouponsHandler, 'execute'>, CouponListResponseDto>>;
export type GetCouponMatches = Expect<Equal<Result<GetCouponHandler, 'execute'>, CouponRecordDto>>;
export type CreateCouponMatches = Expect<Equal<Result<CreateCouponHandler, 'execute'>, CouponRecordDto>>;
export type UpdateCouponMatches = Expect<Equal<Result<UpdateCouponHandler, 'execute'>, CouponRecordDto>>;
export type DeleteCouponMatches = Expect<Equal<Result<DeleteCouponHandler, 'execute'>, void>>;

/** The coupon row DTO is exactly the Prisma model; the redemption row too. */
export type CouponRecordMatchesRow = Expect<Equal<CouponRecordDto, Coupon>>;
export type CouponRedemptionMatchesRow = Expect<Equal<CouponRedemptionRecordDto, CouponRedemption>>;
export type CouponListMatchesEnvelope = Expect<Equal<CouponListResponseDto, Envelope<Coupon>>>;

// ── Moyasar credentials ────────────────────────────────────────────────────

export type GetMoyasarConfigMatches = Expect<Equal<Result<GetMoyasarConfigHandler, 'execute'>, MoyasarConfigViewDto | null>>;
export type UpsertMoyasarConfigMatches = Expect<Equal<Result<UpsertMoyasarConfigHandler, 'execute'>, MoyasarConfigUpsertResponseDto>>;
export type TestMoyasarConfigMatches = Expect<Equal<Result<TestMoyasarConfigHandler, 'execute'>, MoyasarConfigTestResponseDto>>;

type SecretKeys =
  | 'secretKey'
  | 'secretKeyEnc'
  | 'webhookSecret'
  | 'webhookSecretEnc'
  | 'ciphertext'
  | 'credentials'
  | 'apiKey';
type _MoyasarViewHasNoSecret = Expect<Equal<Extract<SecretKeys, keyof MoyasarConfigViewDto>, never>>;
type _MoyasarUpsertHasNoSecret = Expect<Equal<Extract<SecretKeys, keyof MoyasarConfigUpsertResponseDto>, never>>;
type _MoyasarTestHasNoSecret = Expect<Equal<Extract<SecretKeys, keyof MoyasarConfigTestResponseDto>, never>>;

// ── Package purchases (refund + client list) ───────────────────────────────

export type RefundPackagePurchaseMatches = Expect<Equal<Result<RefundPackagePurchaseHandler, 'execute'>, PackagePurchaseRefundResponseDto>>;
export type ListClientPackagePurchasesMatches = Expect<Equal<Result<ListClientPackagePurchasesHandler, 'execute'>, PackagePurchaseListRowDto[]>>;
export type PackageCreditConstraintIsWire = Expect<
  Equal<PackagePurchaseCreditConstraintDto['dimension'], 'SERVICE' | 'PRACTITIONER' | 'DURATION' | 'DELIVERY_TYPE'>
>;
export type PackageCreditAvailabilityKeys = Expect<
  Equal<keyof PackagePurchaseCreditAvailabilityDto, 'bookable' | 'reason'>
>;
export type PackageCreditAddsAvailability = Expect<
  Equal<keyof PackagePurchaseCreditDto['availability'], 'bookable' | 'reason'>
>;

// ── Refunds ────────────────────────────────────────────────────────────────

export type ListRefundsMatches = Expect<Equal<Result<ListRefundsHandler, 'execute'>, RefundRequestListItemDto[]>>;
export type ApproveRefundMatches = Expect<Equal<Result<ApproveRefundHandler, 'execute'>, RefundApprovalResponseDto>>;
export type DenyRefundMatches = Expect<Equal<Result<DenyRefundHandler, 'execute'>, RefundRequestRecordDto>>;
export type RefundRecordMatchesRow = Expect<Equal<RefundRequestRecordDto, RefundRequest>>;
export type RefundListAmountIsInteger = Expect<Equal<RefundRequestListItemDto['amount'], number>>;

// ── Identity (write routes + roles + permissions) ──────────────────────────

export type CreateUserMatches = Expect<Equal<Result<CreateUserHandler, 'execute'>, IdentityUserRecordDto>>;
export type UpdateUserMatches = Expect<Equal<Result<UpdateUserHandler, 'execute'>, IdentityUserRecordDto>>;
export type UpdateUserRoleMatches = Expect<Equal<Result<UpdateUserRoleHandler, 'execute'>, IdentityUserRecordDto>>;
export type ListRolesMatches = Expect<Equal<Result<ListRolesHandler, 'execute'>, IdentityRoleDto[]>>;
export type CreateRoleMatches = Expect<Equal<Result<CreateRoleHandler, 'execute'>, IdentityRoleDto>>;
export type ListPermissionsMatches = Expect<Equal<Result<ListPermissionsHandler, 'execute'>, IdentityPermissionCatalogEntryDto[]>>;

/** The write row is exactly the Prisma user row minus the omitted hash. */
export type IdentityUserRecordMatchesRow = Expect<Equal<IdentityUserRecordDto, Omit<User, 'passwordHash'>>>;
/** The password hash must never be documented. */
type _NoPasswordHash = Expect<Equal<Extract<'passwordHash', keyof IdentityUserRecordDto>, never>>;
export type IdentityRolePermissionKeys = Expect<
  Equal<keyof IdentityRolePermissionDto, 'id' | 'customRoleId' | 'action' | 'subject' | 'createdAt'>
>;

// ── Negative controls: the equality helper is not vacuous ──────────────────

type N_extraKey = Equal<InvoiceRecordDto, InvoiceRecordDto & { organizationId: string }>;
type N_missingKey = Equal<InvoiceRecordDto, Omit<InvoiceRecordDto, 'total'>>;
type N_changedType = Equal<PaymentStatsResponseDto, Omit<PaymentStatsResponseDto, 'total'> & { total: string }>;
type N_optionality = Equal<CouponRecordDto, Omit<CouponRecordDto, 'ref'> & { ref?: number }>;
type N_nullable = Equal<RefundRequestRecordDto, Omit<RefundRequestRecordDto, 'gatewayRef'> & { gatewayRef: string }>;
type N_envelope = Equal<InvoiceListResponseDto, { items: InvoiceListRowDto[] }>;
type N_wrongRoute = Equal<Result<GetInvoiceHandler, 'execute'>, InvoiceRecordDto>;
type N_leakedSecret = Equal<MoyasarConfigViewDto, MoyasarConfigViewDto & { secretKey: string }>;
type N_decimalToNumber = Equal<PaymentRecordDto, Omit<PaymentRecordDto, 'amount'> & { amount: number }>;
type N_userWithHash = Equal<IdentityUserRecordDto, IdentityUserRecordDto & { passwordHash: string }>;
export type ControlsReject = Expect<
  [
    N_extraKey, N_missingKey, N_changedType, N_optionality, N_nullable, N_envelope,
    N_wrongRoute, N_leakedSecret, N_decimalToNumber, N_userWithHash,
  ] extends [false, false, false, false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        InvoiceListRowDto,
        InvoiceListResponseDto,
        InvoiceRecordDto,
        InvoiceDetailResponseDto,
        EnsuredInvoiceDto,
        InvoicePdfUrlDto,
        PaymentRecordDto,
        PaymentListInvoiceSummaryDto,
        PaymentDetailInvoiceSummaryDto,
        PaymentListRowDto,
        PaymentListResponseDto,
        PaymentDetailResponseDto,
        PaymentRefundRequestRowDto,
        PaymentStatsResponseDto,
        PaymentProcessResponseDto,
        PaymentCollectionResponseDto,
        CouponRecordDto,
        CouponListResponseDto,
        CouponRedemptionRecordDto,
        MoyasarConfigViewDto,
        MoyasarConfigUpsertResponseDto,
        MoyasarConfigTestResponseDto,
        PackagePurchaseCreditDto,
        PackagePurchaseListRowDto,
        PackagePurchaseRefundResponseDto,
        RefundRequestListItemDto,
        RefundApprovalResponseDto,
        RefundRequestRecordDto,
        IdentityUserRecordDto,
        IdentityRoleDto,
        IdentityPermissionCatalogEntryDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

const sorted = (values: Iterable<string> = []): string[] => [...values].sort();

describe('finance & identity response schemas (output shape)', () => {
  it('documents the invoice list row exactly, all required, money as decimal strings', async () => {
    const schemas = await buildSchemas();
    const row = schemas.InvoiceListRowDto;
    expect(sorted(Object.keys(row.properties ?? {}))).toEqual(
      sorted([
        'id', 'number', 'clientId', 'bookingId', 'clientName', 'subtotal', 'vatAmt', 'total',
        'refundedAmount', 'currency', 'status', 'issuedAt', 'paidAt', 'sentToClientAt', 'hasPdf', 'createdAt',
      ]),
    );
    expect(sorted(row.required)).toEqual(sorted(Object.keys(row.properties ?? {})));
    for (const key of ['subtotal', 'vatAmt', 'total', 'refundedAmount']) {
      expect(row.properties?.[key]).toMatchObject({ type: 'string' });
    }
    expect(sorted(schemas.InvoiceListResponseDto.required)).toEqual(['items', 'meta']);
  });

  it('documents the invoice record as the full Prisma row plus payments on detail', async () => {
    const schemas = await buildSchemas();
    const record = schemas.InvoiceRecordDto;
    expect(sorted(record.required)).toEqual(sorted(Object.keys(record.properties ?? {})));
    expect(record.properties?.vatRate).toMatchObject({ type: 'string' });
    expect(schemas.InvoiceDetailResponseDto.properties?.payments).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PaymentRecordDto' },
    });
  });

  it('documents payment money as decimal strings and stats money as numbers', async () => {
    const schemas = await buildSchemas();
    const payment = schemas.PaymentRecordDto;
    for (const key of ['amount', 'refundedAmount']) {
      expect(payment.properties?.[key]).toMatchObject({ type: 'string' });
    }
    expect(payment.properties?.status).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/PaymentStatus' }],
    });
    const stats = schemas.PaymentStatsResponseDto;
    for (const key of [
      'total', 'totalAmount', 'completed', 'completedAmount', 'pending', 'pendingAmount',
      'pendingVerification', 'pendingVerificationAmount', 'refunded', 'refundedAmount', 'failed',
    ]) {
      expect(stats.properties?.[key]).toMatchObject({ type: 'number' });
    }
    expect(stats.properties?.historical).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/PaymentHistoricalStatsDto' }],
    });
  });

  it('keeps the Moyasar view free of any secret-bearing field', async () => {
    const schemas = await buildSchemas();
    const view = schemas.MoyasarConfigViewDto;
    expect(sorted(Object.keys(view.properties ?? {}))).toEqual(
      sorted([
        'publishableKey', 'secretKeyMasked', 'hasWebhookSecret', 'isLive',
        'lastVerifiedAt', 'lastVerifiedStatus', 'updatedAt',
      ]),
    );
    for (const forbidden of ['secretKey', 'secretKeyEnc', 'webhookSecret', 'webhookSecretEnc', 'ciphertext']) {
      expect(view.properties?.[forbidden]).toBeUndefined();
    }
    expect(schemas.MoyasarConfigUpsertResponseDto.properties).not.toHaveProperty('secretKey');
    expect(schemas.MoyasarConfigTestResponseDto.properties).not.toHaveProperty('secretKey');
  });

  it('documents the identity write row without passwordHash', async () => {
    const schemas = await buildSchemas();
    const user = schemas.IdentityUserRecordDto;
    expect(user.properties).not.toHaveProperty('passwordHash');
    expect(sorted(user.required)).toEqual(sorted(Object.keys(user.properties ?? {})));
    expect(schemas.IdentityRoleDto.properties?.permissions).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/IdentityRolePermissionDto' },
    });
  });

  it('documents the refund row with Decimal amounts as strings', async () => {
    const schemas = await buildSchemas();
    const record = schemas.RefundRequestRecordDto;
    expect(record.properties?.amount).toMatchObject({ type: 'string' });
    expect(schemas.RefundRequestListItemDto.properties?.amount).toMatchObject({ type: 'integer' });
    expect(schemas.RefundApprovalResponseDto.required).toEqual(
      expect.arrayContaining(['id', 'status']),
    );
    expect(schemas.RefundApprovalResponseDto.required).not.toContain('gatewayRef');
  });
});
