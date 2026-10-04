import { ApiProperty, OmitType } from '@nestjs/swagger';
import type { ClientCancellationPreview, CancellationRefundSummary } from './client-cancellation-policy';

export class CancellationRefundSummaryDto implements CancellationRefundSummary {
  @ApiProperty({ description: 'Expected financial outcome if the client confirms cancellation; pending states do not mean money has been returned', enum: ['NOT_APPLICABLE', 'NO_REFUND', 'PENDING_REVIEW', 'PROCESSING', 'CREDIT_RETURNED'] })
  status!: CancellationRefundSummary['status'];
  @ApiProperty({ type: 'integer', description: 'Captured original amount in halalas' }) paidAmount!: number;
  @ApiProperty({ type: 'integer', description: 'Already refunded amount in halalas' }) alreadyRefundedAmount!: number;
  @ApiProperty({ type: 'integer', description: 'Reserved pending amount in halalas' }) pendingRefundAmount!: number;
  @ApiProperty({ type: 'integer', description: 'New remaining refund entitlement in halalas' }) refundAmount!: number;
  @ApiProperty({ description: 'Policy percentage for the applicable cancellation window', type: Number, minimum: 0, maximum: 100 }) refundPercent!: number;
  @ApiProperty({ example: 'SAR' }) currency!: string;
  @ApiProperty({ description: 'Whether the refund needs no action, provider processing, or staff review', enum: ['NONE', 'AUTOMATIC', 'REVIEW'] }) execution!: CancellationRefundSummary['execution'];
  @ApiProperty({ description: 'Refund policy window relative to the configured early cancellation threshold', enum: ['EARLY', 'LATE'] }) window!: CancellationRefundSummary['window'];
}
export class ClientCancellationPreviewDto implements ClientCancellationPreview {
  @ApiProperty({ description: 'Whether the new client cancellation policy is explicitly enabled' }) policyEnabled!: boolean;
  @ApiProperty({ description: 'Current eligibility to cancel this appointment directly' }) canCancel!: boolean;
  @ApiProperty({ description: 'Eligibility decision or reason cancellation is unavailable', enum: ['ALLOWED', 'POLICY_NOT_CONFIGURED', 'CUTOFF_PASSED', 'ATTENDED', 'FINAL_STATE', 'HISTORICAL', 'GROUP_STAFF_ONLY'] }) reasonCode!: ClientCancellationPreview['reasonCode'];
  @ApiProperty({ description: 'Effective cancellation deadline, or null when no valid deadline is configured', type: String, nullable: true, format: 'date-time' }) cutoffAt!: string | null;
  @ApiProperty({ description: 'Opaque effective terms fingerprint' }) quoteToken!: string;
  @ApiProperty({ description: 'Financial terms shown to the client before cancellation confirmation', type: CancellationRefundSummaryDto }) refund!: CancellationRefundSummaryDto;
}

export class PersistedCancellationRefundDto extends OmitType(CancellationRefundSummaryDto, ['status'] as const) {
  @ApiProperty({ description: 'Persisted cancellation refund outcome derived from confirmed ledger entries and request states', enum: ['NOT_APPLICABLE', 'NO_REFUND', 'PENDING_REVIEW', 'PROCESSING', 'CREDIT_RETURNED', 'COMPLETED', 'FAILED'] })
  status!: CancellationRefundSummary['status'] | 'COMPLETED' | 'FAILED';
  @ApiProperty({ type: 'integer', description: 'Ledger-confirmed refunded amount toward this cancellation, in halalas' }) completedAmount!: number;
  @ApiProperty({ type: 'integer', description: 'Failed or denied request amount, in halalas' }) failedAmount!: number;
}
