import type { StaffCancellationIntent } from './staff-cancellation-refund';
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import { stableEventId } from '../../../common/events';
import { RefundPaymentHandler } from '../refund-payment/refund-payment.handler';
import { RESERVED_REFUND_STATUSES, type ClientCancellationIntent } from '../../bookings/client/client-cancellation-policy';
import { decimalToHalalas } from '../money.helper';

/** Financial follow-up only. Cancellation is already committed. */
@Injectable()
export class CancellationRefundIntentService {
  constructor(private readonly rls: RlsTransactionService, private readonly refunds: RefundPaymentHandler) {}

  async execute(eventId: string, bookingId: string, clientId: string, intent: ClientCancellationIntent | StaffCancellationIntent): Promise<void> {
    if (intent.version !== 1) throw new ConflictException('Unsupported cancellation refund intent');
    const reason = intent.initiatedBy === 'CLIENT' ? `Client cancellation ${bookingId}` : intent.reason;
    const performedBy = intent.initiatedBy === 'CLIENT' ? clientId : intent.performedBy;
    const failures: unknown[] = [];
    const ownSources = new Set(intent.allocations.map(a => stableEventId(`${eventId}:payment:${a.paymentId}`)));
    for (const allocation of [...intent.allocations].sort((a, b) => a.paymentId.localeCompare(b.paymentId))) {
      try {
        const sourceEventId = stableEventId(`${eventId}:payment:${allocation.paymentId}`);
        const request = await this.rls.withTransaction(async tx => {
          // Match cancellation/finance lock order across every booking capture, including
          // payments with no allocation: a competing claim there consumes the same policy entitlement.
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "bookingId" = ${bookingId} ORDER BY "id" FOR UPDATE`);
          await tx.$queryRaw(Prisma.sql`SELECT p."id" FROM "Payment" p JOIN "Invoice" i ON i."id" = p."invoiceId" WHERE i."bookingId" = ${bookingId} ORDER BY p."id" FOR UPDATE OF p`);
          const previous = await tx.refundRequest.findUnique({ where: { sourceEventId } });
          if (previous) return previous;
          const captures = await tx.payment.findMany({
            where: { invoice: { bookingId }, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
            orderBy: { id: 'asc' }, include: { refundRequests: true },
          });
          const payment = captures.find(p => p.id === allocation.paymentId);
          if (!payment || payment.invoiceId !== allocation.invoiceId) throw new ConflictException('Refund payment invoice changed');
          const refunded = decimalToHalalas(payment.refundedAmount);
          const pending = payment.refundRequests.filter(r => RESERVED_REFUND_STATUSES.includes(r.status)).reduce((n, r) => n + decimalToHalalas(r.amount), 0);
          const aggregateClaims = captures.reduce((total, capture) => total + decimalToHalalas(capture.refundedAmount)
            + capture.refundRequests.filter(r => RESERVED_REFUND_STATUSES.includes(r.status)).reduce((n, r) => n + decimalToHalalas(r.amount), 0), 0);
          // Own completed requests are already represented by refundedAmount; own
          // reservations are already in aggregateClaims. Remove them before comparing
          // competing claims with the original baseline, then consume the frozen NEW budget once.
          const ownClaims = captures.reduce((total, capture) => total + capture.refundRequests
            .filter(r => r.sourceEventId && ownSources.has(r.sourceEventId) && (r.status === 'COMPLETED' || RESERVED_REFUND_STATUSES.includes(r.status)))
            .reduce((n, r) => n + decimalToHalalas(r.amount), 0), 0);
          const competingClaims = Math.max(0, aggregateClaims - ownClaims - intent.refund.alreadyRefundedAmount - intent.refund.pendingRefundAmount);
          const remainingEntitlement = Math.max(0, intent.refund.refundAmount - ownClaims - competingClaims);
          const additionalClaims = Math.max(0, refunded + pending - allocation.baselineRefundedAmount - allocation.baselinePendingAmount);
          const amount = Math.min(remainingEntitlement, Math.max(0, allocation.amount - additionalClaims), Math.max(0, decimalToHalalas(payment.amount) - refunded - pending));
          if (!amount || payment.status === 'REFUNDED') return null;
          if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status)) throw new ConflictException('Payment no longer refundable');
          const automatic = allocation.execution === 'AUTOMATIC' && payment.method === 'ONLINE_CARD' && payment.gatewayRef && refunded === 0 && pending === 0;
          if (automatic) {
            const created = await this.refunds.createRefundRequestInTx(tx, { paymentId: payment.id, amount, reason, performedBy, sourceEventId });
            return { id: created.refundRequestId, status: 'PROCESSING', idempotencyKey: created.idempotencyKey };
          }
          // Cash/transfer and second gateway refunds need actual staff settlement.
          // Do not invoke the helper's off-gateway accounting completion path.
          const id = stableEventId(`${sourceEventId}:request`);
          return tx.refundRequest.create({ data: { id, invoiceId: payment.invoiceId, paymentId: payment.id, clientId, amount, reason, status: 'PENDING_REVIEW', sourceEventId, idempotencyKey: `refund:${id}` } });
        }, { isolationLevel: 'Serializable' });
        if (request?.status === 'PROCESSING' && request.idempotencyKey) {
          // Provider calls and leases stay exclusively owned by the finance state machine.
          await this.refunds.finalizeRefundFromCancellation({ refundRequestId: request.id, idempotencyKey: request.idempotencyKey, sourceEventId });
        }
        if (request) await this.captureOutcome(request.id, eventId, bookingId, clientId);
      } catch (error) {
        failures.push(error);
      }
    }
    // One failed payment must not prevent following payments from being queued.
    if (failures.length) throw failures[0];
  }

  private async captureOutcome(refundRequestId: string, cancellationEventId: string, bookingId: string, clientId: string): Promise<void> {
    await this.rls.withTransaction(async tx => {
      const request = await tx.refundRequest.findUniqueOrThrow({ where: { id: refundRequestId } });
      // Success is independently notified from the confirmed ledger event.
      if (!['PENDING_REVIEW', 'MANUAL_REVIEW', 'FAILED', 'DENIED'].includes(request.status)) return;
      const id = stableEventId(`${cancellationEventId}:refund:${request.id}:${request.status}`);
      await tx.outboxEvent.upsert({ where: { id }, update: {}, create: {
        id, aggregateId: bookingId, eventType: 'finance.cancellation-refund.updated',
        payload: { eventId: id, source: 'finance', version: 1, occurredAt: new Date().toISOString(), payload: { bookingId, clientId, refundRequestId: request.id, status: request.status, amount: decimalToHalalas(request.amount) } },
      } });
    });
  }
}
