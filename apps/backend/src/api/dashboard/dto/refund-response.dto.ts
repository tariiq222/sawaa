import { ApiProperty } from '@nestjs/swagger';
import { Prisma, RefundProviderState, RefundStatus, type RefundRequest } from '@prisma/client';

/**
 * Response shapes of `dashboard/refunds.controller.ts`.
 *
 * Documentation only. `ListRefundsHandler` converts `Decimal.amount` with
 * `Number()` and ISO-stringifies its dates, so the list is integer halalas and
 * string timestamps; `DenyRefundHandler` returns the persisted `RefundRequest`
 * row verbatim (Decimal stays a decimal string on the wire);
 * `ApproveRefundHandler` returns its own projection with an optional
 * `gatewayRef`.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000e1';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** One refund request in `GET /dashboard/refunds` (handler-mapped, integer halalas). */
export class RefundRequestListItemDto {
  @ApiProperty({ format: 'uuid', description: 'Refund request UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-0000000000e2' })
  invoiceId!: string;

  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: '00000000-0000-4000-a000-0000000000e3' })
  paymentId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string;

  @ApiProperty({ type: 'integer', description: 'Refund amount in integer halalas', example: 5000 })
  amount!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Refund reason, or null', example: 'Service not delivered' })
  reason!: string | null;

  @ApiProperty({ description: 'Refund request status', example: 'PENDING_REVIEW' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant as an ISO 8601 timestamp', example: ISO_EXAMPLE })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Processing instant as an ISO 8601 timestamp, or null', example: null })
  processedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Denial reason, or null', example: null })
  denialReason!: string | null;
}

/** `POST /dashboard/refunds/approve` — the projection `ApproveRefundHandler` returns. */
export class RefundApprovalResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Refund request UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Refund request status after the approval attempt', example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ type: String, nullable: true, required: false, description: 'Provider refund reference; present only when the request reached one', example: 'refund_abc123' })
  gatewayRef?: string;
}

/** `POST /dashboard/refunds/deny` — the persisted `RefundRequest` row. */
export class RefundRequestRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Refund request UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-0000000000e2' })
  invoiceId!: string;

  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: '00000000-0000-4000-a000-0000000000e3' })
  paymentId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string;

  @ApiProperty({ type: String, description: 'Refund amount in halalas (decimal string)', example: '5000' })
  amount!: Prisma.Decimal;

  @ApiProperty({ type: String, nullable: true, description: 'Refund reason, or null', example: 'Service not delivered' })
  reason!: string | null;

  @ApiProperty({ enum: RefundStatus, enumName: 'RefundStatus', example: 'DENIED' })
  status!: RefundStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Processing instant, or null', example: ISO_EXAMPLE })
  processedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Staff user UUID that processed the request, or null', example: null })
  processedBy!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Denial reason, or null', example: 'Refund window has expired' })
  denialReason!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Provider refund reference, or null', example: null })
  gatewayRef!: string | null;

  @ApiProperty({ enum: RefundProviderState, enumName: 'RefundProviderState', example: 'BEFORE_CALL' })
  providerState!: RefundProviderState;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Last provider attempt instant, or null', example: null })
  lastProviderAttemptAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Last provider error, or null', example: null })
  lastProviderError!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Provider lease owner, or null', example: null })
  providerLeaseOwner!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Provider lease expiry, or null', example: null })
  providerLeaseExpiresAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Stable refund identity across replays, or null', example: null })
  idempotencyKey!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Cancellation event that created the request, or null', example: null })
  sourceEventId!: string | null;

  @ApiProperty({ description: 'Provider attempt count', example: 0 })
  providerAttemptCount!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Cumulative refunded baseline at call time (decimal string), or null', example: null })
  baselineRefundedAmount!: Prisma.Decimal | null;

  @ApiProperty({ type: String, nullable: true, description: 'Target cumulative refunded amount (decimal string), or null', example: null })
  targetCumulativeRefundedAmount!: Prisma.Decimal | null;

  @ApiProperty({ type: String, nullable: true, description: 'Observed cumulative refunded amount (decimal string), or null', example: null })
  observedCumulativeRefundedAmount!: Prisma.Decimal | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

// Compile-time guard: the deny DTO must list exactly the Prisma columns.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const refundRecordDtoMatchesPrismaRow: Equal<keyof RefundRequestRecordDto, keyof RefundRequest> = true;
