import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, DeliveryType, Prisma } from '@prisma/client';
import { stableEventId } from '../../../common/events';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { BookingZoomCreateRequestedEvent } from '../events/booking-zoom-create-requested.event';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelRejectedEvent } from '../events/booking-cancel-rejected.event';
import { assertTransition } from '../booking-state-machine';
import { isUnconfirmedHoldStatus, nextHoldExpiry } from '../booking-hold-window';
import { assertBookingIsMutable, updateBookingAtomically } from '../booking-lifecycle.helper';

export interface RejectCancelBookingCommand {
  bookingId: string;
  rejectedBy: string;
  rejectReason: string;
}

@Injectable()
export class RejectCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: RejectCancelBookingCommand) {
    const { booking, updated } = await this.rlsTransaction.withTransaction(async tx => {
      // Capture/webhook transactions use Booking -> Invoice ordering. The invoice
      // lock also waits for ordinary capture paths before we re-read the money.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${cmd.bookingId} FOR UPDATE`);
      const booking = await tx.booking.findFirst({ where: { id: cmd.bookingId } });
      if (!booking) throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
      assertBookingIsMutable(booking);
      const requestLog = await tx.bookingStatusLog.findFirst({
        where: { bookingId: cmd.bookingId, toStatus: BookingStatus.CANCEL_REQUESTED },
        orderBy: { createdAt: 'desc' },
      });
      let nextStatus = assertTransition(booking.status, 'REJECT_CANCEL', requestLog?.fromStatus ?? null);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "bookingId" = ${booking.id} ORDER BY "id" FOR UPDATE`);
      const invoice = await tx.invoice.findFirst({ where: { bookingId: booking.id } });
      if (invoice) {
        const captures = await tx.payment.findMany({
          where: { invoiceId: invoice.id, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
        });
        // Refunds do not reverse the fact that attendance was confirmed by a capture.
        const grossCaptured = captures.filter(p => p.currency === invoice.currency)
          .reduce((total, payment) => total + Number(payment.amount), 0);
        if (Number(invoice.total) > 0 && grossCaptured >= Number(invoice.total)) {
          nextStatus = BookingStatus.CONFIRMED;
        } else if (isUnconfirmedHoldStatus(nextStatus) && captures.length) {
          // The event is frozen at capture time. Current deposit settings may
          // have changed, so an arbitrary partial payment is never deposit proof.
          const evidence = await tx.outboxEvent.findMany({
            where: { eventType: 'finance.payment.deposit_paid', payload: { path: ['payload', 'bookingId'], equals: booking.id } },
            select: { payload: true },
          });
          const qualifies = evidence.some(row => {
            const envelope = row.payload as unknown as { payload?: { bookingId?: string; invoiceId?: string; paymentId?: string } };
            const proof = envelope?.payload;
            return proof?.bookingId === booking.id && proof.invoiceId === invoice.id
              && captures.some(payment => payment.id === proof.paymentId && payment.invoiceId === invoice.id && payment.currency === invoice.currency && Number(payment.amount) > 0);
          });
          if (qualifies) nextStatus = BookingStatus.DEPOSIT_PAID;
        }
      }
      const confirmed = nextStatus === BookingStatus.CONFIRMED || nextStatus === BookingStatus.DEPOSIT_PAID;
      const updated = await updateBookingAtomically(tx, {
        bookingId: booking.id, currentStatus: booking.status, actionLabel: 'cancel rejection applied',
        data: {
          status: nextStatus, cancelReason: null, cancelNotes: null,
          expiresAt: isUnconfirmedHoldStatus(nextStatus) && booking.expiresAt ? nextHoldExpiry() : null,
          ...(confirmed ? { confirmedAt: booking.confirmedAt ?? new Date() } : {}),
        },
      });
      const rejectionLog = await tx.bookingStatusLog.create({ data: {
        bookingId: booking.id, fromStatus: booking.status, toStatus: nextStatus,
        changedBy: cmd.rejectedBy, reason: cmd.rejectReason,
      } });
      if (confirmed && booking.deliveryType === DeliveryType.ONLINE && !booking.zoomMeetingId) {
        const zoom = new BookingZoomCreateRequestedEvent({ bookingId: booking.id, organizationId: DEFAULT_ORG_ID });
        // A prior request may already have been consumed while CANCEL_REQUESTED.
        // Each rejection episode needs a distinct queue identity; replaying the
        // same episode stays idempotent. Legacy missing request history uses the
        // rejection log committed in this transaction as its durable episode ID.
        const recoveryId = stableEventId(`${zoom.eventId}:cancel-rejected:${requestLog?.id ?? rejectionLog.id}`);
        await tx.outboxEvent.upsert({ where: { id: recoveryId }, update: {}, create: {
          id: recoveryId, aggregateId: booking.id, eventType: zoom.eventName,
          status: 'PENDING_V2', deliveryLane: 'PENDING_V2',
          payload: { ...zoom.toEnvelope(), eventId: recoveryId } as unknown as Prisma.InputJsonValue,
        } });
      }
      return { booking, updated };
    });

    const event = new BookingCancelRejectedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      rejectReason: cmd.rejectReason,
    });
    await this.eventBus.publishOptional(event.eventName, event.toEnvelope());

    return updated;
  }
}
