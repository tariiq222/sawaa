import type { StaffCancellationIntent } from './staff-cancellation-refund';
import { Prisma } from '@prisma/client';
import { stableEventId } from '../../../common/events';
import { type ClientCancellationIntent } from '../../bookings/client/client-cancellation-policy';
import { decimalToHalalas } from '../money.helper';

/** Called inside the transaction that persists a later refund outcome. */
export async function captureCancellationRefundOutcome(tx: Prisma.TransactionClient, refundRequestId: string): Promise<void> {
  const request = await tx.refundRequest.findUniqueOrThrow({ where: { id: refundRequestId }, include: { invoice: true } });
  if (!request.sourceEventId || !['DENIED', 'FAILED', 'MANUAL_REVIEW'].includes(request.status)) return;
  const bookingId = request.invoice.bookingId;
  if (!bookingId) return;
  const log = await tx.bookingStatusLog.findFirst({ where: { bookingId, toStatus: 'CANCELLED' }, orderBy: { createdAt: 'desc' } });
  const stored = log?.sourceActionResult as { cancellationEventId?: string } | null;
  let cancellationEventId = stored?.cancellationEventId;
  let cancellation = cancellationEventId && request.sourceEventId === stableEventId(`${cancellationEventId}:payment:${request.paymentId}`)
    ? await tx.outboxEvent.findUnique({ where: { id: cancellationEventId } }) : null;
  if (!cancellation) {
    // Retained terminal participants have no CANCELLED status log. Resolve the
    // exact financial source against this booking's durable cancellation events.
    const candidates = await tx.outboxEvent.findMany({ where: { aggregateId: bookingId, eventType: { in: ['bookings.booking.cancelled', 'bookings.booking.cancel_approved'] } }, orderBy: { createdAt: 'desc' } });
    cancellation = candidates.find(event => request.sourceEventId === stableEventId(`${event.id}:payment:${request.paymentId}`)) ?? null;
    cancellationEventId = cancellation?.id;
  }
  const payload = (cancellation?.payload as unknown as { payload?: { clientCancellation?: ClientCancellationIntent; centerCancellation?: StaffCancellationIntent; staffCancellation?: StaffCancellationIntent } })?.payload;
  const intent = payload?.clientCancellation ?? payload?.centerCancellation ?? payload?.staffCancellation;
  if (!cancellationEventId || intent?.version !== 1 || !['CLIENT', 'STAFF', 'CENTER'].includes(intent.initiatedBy) || !intent.allocations.some(a => a.paymentId === request.paymentId)) return;
  // Same identity used by initial follow-up: replay and later observation cannot
  // create a second notification for the same persisted request/status.
  const id = stableEventId(`${cancellationEventId}:refund:${request.id}:${request.status}`);
  await tx.outboxEvent.upsert({ where: { id }, update: {}, create: {
    id, aggregateId: bookingId, eventType: 'finance.cancellation-refund.updated',
    payload: { eventId: id, source: 'finance', version: 1, occurredAt: new Date().toISOString(), payload: {
      bookingId, clientId: request.clientId, refundRequestId: request.id, status: request.status, amount: decimalToHalalas(request.amount),
    } },
  } });
}
