import { Injectable, Logger, Optional } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';
import { CreateZoomMeetingHandler } from '../create-zoom-meeting/create-zoom-meeting.handler';

interface PaymentCompletedPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string | null;
  bundlePurchaseId?: string | null;
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
    @Optional() private readonly createZoomMeeting?: CreateZoomMeetingHandler,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      async (envelope) => {
        const { bookingId, paymentId } = envelope.payload;
        // Bundle-purchase invoices have no bookingId — skip booking confirmation.
        if (!bookingId) {
          this.logger.log(`Payment ${paymentId} completed for bundle purchase — no booking to confirm`);
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
            await this.rlsTransaction.withTransaction((tx) => Promise.all([
              tx.booking.update({
                where: { id: bookingId },
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
            ]));

            // For ONLINE bookings, provision the Zoom meeting now that payment
            // confirmed the booking — mirrors the admin confirm-booking path.
            // Best-effort: the Zoom handler persists FAILED status internally on
            // API errors, and this catch swallows any other failure so a Zoom
            // outage can never fail the payment confirmation. Runs inside the
            // tenant CLS window so the Zoom handler's tenant-scoped reads pass.
            if (booking.deliveryType === DeliveryType.ONLINE && this.createZoomMeeting) {
              try {
                await this.createZoomMeeting.execute({ bookingId });
              } catch (zoomErr) {
                this.logger.error(
                  `Failed to create Zoom meeting for booking ${bookingId} after payment ${paymentId}`,
                  zoomErr,
                );
              }
            }
          });
        } catch (err) {
          this.logger.error(`Failed to confirm booking ${bookingId} after payment`, err);
          throw err;
        }
      },
    );
  }
}
