import { BadRequestException } from '@nestjs/common';
import { CancellationPayment, CancellationRefundAllocation, RESERVED_REFUND_STATUSES } from '../../bookings/client/client-cancellation-policy';

export interface StaffCancellationIntent {
  version: 1;
  initiatedBy: 'STAFF' | 'CENTER';
  reason: string;
  performedBy: string;
  refund: { paidAmount: number; alreadyRefundedAmount: number; pendingRefundAmount: number; refundAmount: number; currency: string };
  allocations: CancellationRefundAllocation[];
}
const integer = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new BadRequestException('Invalid refund amount');
  return amount;
};
export function buildStaffCancellationIntent(input: {
  payments: CancellationPayment[]; currency: string; refundAmount?: number;
  initiatedBy: 'STAFF' | 'CENTER'; reason: string; performedBy: string; automatic: boolean;
}): StaffCancellationIntent {
  const payments = input.payments.filter(p => ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status))
    .sort((a, b) => a.id.localeCompare(b.id)).map(p => ({ ...p, amount: integer(p.amount), refundedAmount: integer(p.refundedAmount ?? 0),
      pending: p.refundRequests.filter(r => RESERVED_REFUND_STATUSES.includes(r.status)).reduce((n, r) => n + integer(r.amount), 0) }));
  if (payments.some(p => p.currency !== input.currency)) throw new BadRequestException('Cancellation payments have inconsistent currencies');
  const available = payments.reduce((n, p) => n + Math.max(0, p.amount - p.refundedAmount - p.pending), 0);
  const amount = input.refundAmount === undefined ? available : integer(input.refundAmount);
  if (amount > available) throw new BadRequestException('Refund exceeds available payment amount');
  let remaining = amount;
  const allocations: CancellationRefundAllocation[] = [];
  for (const p of payments) {
    const allocated = Math.min(remaining, Math.max(0, p.amount - p.refundedAmount - p.pending));
    if (!allocated) continue;
    const automatic = input.automatic && p.method === 'ONLINE_CARD' && p.gatewayRef && !p.refundedAmount && !p.pending;
    allocations.push({ paymentId: p.id, invoiceId: p.invoiceId, amount: allocated, execution: automatic ? 'AUTOMATIC' : 'REVIEW', baselineRefundedAmount: p.refundedAmount, baselinePendingAmount: p.pending });
    remaining -= allocated;
  }
  return { version: 1, initiatedBy: input.initiatedBy, reason: input.reason, performedBy: input.performedBy,
    refund: { paidAmount: payments.reduce((n, p) => n + p.amount, 0), alreadyRefundedAmount: payments.reduce((n, p) => n + p.refundedAmount, 0), pendingRefundAmount: payments.reduce((n, p) => n + p.pending, 0), refundAmount: amount, currency: input.currency }, allocations };
}
