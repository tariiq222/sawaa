import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, DeliveryType, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';
import { BookingZoomCreateRequestedEvent } from '../events/booking-zoom-create-requested.event';
import { updateBookingAtomically } from '../booking-lifecycle.helper';

interface PaymentCompletedPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string | null;
  packagePurchaseId?: string | null;
}

/**
 * Subscribes to finance.payment.completed.
 *
 * Runs inside a BullMQ Worker — no inherited CLS context. Opens a
 * systemContext window to read the booking (so the tenant-scoping Prisma
 * extension lets the query through), then a tenant-scoped window to apply
 * the confirmation update + status log. Mirrors MoyasarWebhookHandler.
 */
@Injectable()
export class PaymentCompletedEventHandler {
  private readonly logger = new Logger(PaymentCompletedEventHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly cls: ClsService,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      'bookings.payment-completed-confirm.v1',
      async (envelope) => {
        const { bookingId, paymentId } = envelope.payload;
        // Package-purchase invoices have no bookingId — skip booking confirmation.
        if (!bookingId) {
          this.logger.log(`Payment ${paymentId} completed for package purchase — no booking to confirm`);
          return;
        }
        try {
          const booking = await this.cls.run(async () => {
            this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
            return this.prisma.booking.findFirst({ where: { id: bookingId } });
          });
          if (!booking) return;
          // Use assertTransition to guard PAYMENT_CONFIRMED; skip silently if already in a
          // terminal or non-payment-pending state (idempotency for duplicate events).
          let nextStatus: BookingStatus;
          try {
            nextStatus = assertTransition(booking.status, 'PAYMENT_CONFIRMED');
          } catch {
            this.logger.warn(`Payment ${paymentId}: booking ${bookingId} status '${booking.status}' does not allow PAYMENT_CONFIRMED — skipping`);
            return;
          }

          await this.cls.run(async () => {
            this.cls.set('tenant', {
              organizationId: DEFAULT_ORG_ID,
              id: 'system',
              role: 'system',
              isSuperAdmin: false,
            });
            const zoomEvent = booking.deliveryType === DeliveryType.ONLINE
              ? new BookingZoomCreateRequestedEvent({ organizationId: DEFAULT_ORG_ID, bookingId })
              : null;
            await this.rlsTransaction.withTransaction((tx) => Promise.all([
              updateBookingAtomically(tx, {
                bookingId,
                currentStatus: booking.status,
                actionLabel: 'confirmed after payment',
                data: { status: nextStatus, confirmedAt: new Date() },
              }),
              tx.bookingStatusLog.create({
                data: {
                  bookingId,
                  fromStatus: booking.status,
                  toStatus: nextStatus,
                  changedBy: 'system',
                  reason: `payment:${paymentId}`,
                },
              }),
              ...(zoomEvent ? [tx.outboxEvent.create({
                data: {
                  id: zoomEvent.eventId,
                  aggregateId: bookingId,
                  eventType: zoomEvent.eventName,
                  payload: zoomEvent.toEnvelope() as unknown as Prisma.InputJsonValue,
                },
              })] : []),
            ]));
          });
        } catch (err) {
          this.logger.error(`Failed to confirm booking ${bookingId} after payment`, err);
          throw err;
        }
      },
    );
  }
}
