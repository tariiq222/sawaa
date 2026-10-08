import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, DeliveryType, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY, DEFAULT_ORG_ID } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';
import { updateBookingAtomically } from '../booking-lifecycle.helper';
import { BookingZoomCreateRequestedEvent } from '../events/booking-zoom-create-requested.event';

interface DepositPaidPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string | null;
}

/**
 * Subscribes to finance.payment.deposit_paid.
 *
 * Fired when a client pays the EXACT configured service deposit (the invoice is
 * PARTIALLY_PAID, not PAID). Moves the booking PENDING|AWAITING_PAYMENT →
 * DEPOSIT_PAID, operationally confirming the appointment while a balance stays due.
 * ONLINE appointments stage a durable Zoom request in the confirmation transaction;
 * invoice/payment balances remain untouched.
 *
 * Idempotent: if the booking is already DEPOSIT_PAID (or any state that does not
 * permit DEPOSIT_CONFIRMED), the duplicate event is skipped silently. Mirrors
 * PaymentCompletedEventHandler's CLS windowing for the BullMQ worker context.
 */
@Injectable()
export class DepositPaidEventHandler {
  private readonly logger = new Logger(DepositPaidEventHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly cls: ClsService,
  ) {}

  register(): void {
    this.eventBus.subscribe<DepositPaidPayload>(
      'finance.payment.deposit_paid',
      'bookings.deposit-paid.v1',
      async (envelope) => {
        const { bookingId, paymentId } = envelope.payload;
        // Package-purchase invoices carry no bookingId — deposits never apply.
        if (!bookingId) {
          this.logger.log(`Deposit ${paymentId} paid for package purchase — no booking to update`);
          return;
        }
        try {
          const booking = await this.cls.run(async () => {
            this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
            return this.prisma.booking.findFirst({ where: { id: bookingId } });
          });
          if (!booking || booking.lateEntryRecordedAt) return;

          // Guard DEPOSIT_CONFIRMED; skip silently if the booking is already
          // DEPOSIT_PAID or in any state that does not allow the transition
          // (idempotency for duplicate / replayed events).
          let nextStatus: BookingStatus;
          try {
            nextStatus = assertTransition(booking.status, 'DEPOSIT_CONFIRMED');
          } catch {
            this.logger.warn(
              `Deposit ${paymentId}: booking ${bookingId} status '${booking.status}' does not allow DEPOSIT_CONFIRMED — skipping`,
            );
            return;
          }

          await this.cls.run(async () => {
            this.cls.set('tenant', {
              organizationId: DEFAULT_ORG_ID,
              id: 'system',
              role: 'system',
              isSuperAdmin: false,
            });
            const zoomEvent = booking.deliveryType === DeliveryType.ONLINE && !booking.zoomMeetingId
              ? new BookingZoomCreateRequestedEvent({ organizationId: DEFAULT_ORG_ID, bookingId })
              : null;
            await this.rlsTransaction.withTransaction(async (tx) => {
              await updateBookingAtomically(tx, {
                bookingId,
                currentStatus: booking.status,
                actionLabel: 'deposit paid',
                data: { status: nextStatus, confirmedAt: booking.confirmedAt ?? new Date() },
              });
              await tx.bookingStatusLog.create({
                data: {
                  bookingId,
                  fromStatus: booking.status,
                  toStatus: nextStatus,
                  changedBy: 'system',
                  reason: `deposit:${paymentId}`,
                },
              });
              if (zoomEvent) {
                // The event's booking-derived identity also covers later full
                // settlement. Never reset an already-published request on replay.
                await tx.outboxEvent.upsert({
                  where: { id: zoomEvent.eventId },
                  update: {},
                  create: {
                    id: zoomEvent.eventId,
                    aggregateId: bookingId,
                    eventType: zoomEvent.eventName,
                    status: 'PENDING_V2',
                    deliveryLane: 'PENDING_V2',
                    payload: zoomEvent.toEnvelope() as unknown as Prisma.InputJsonValue,
                  },
                });
              }
            });
          });
        } catch (err) {
          this.logger.error(`Failed to mark booking ${bookingId} DEPOSIT_PAID after deposit`, err);
          throw err;
        }
      },
    );
  }
}
