import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { DEFAULT_ORG_ID, SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';

interface RefundCompletedPayload {
  refundRequestId: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  bookingId: string | null;
  amount: number;
  currency: string;
}

/**
 * SECURITY (P0-15): when a refund completes the booking MUST be torn down,
 * not left in CONFIRMED with a live Zoom join URL. Otherwise a refunded
 * client retains free meeting/recording access — straight refund fraud.
 *
 * Cascade:
 *   1. Booking → CANCELLED (if not already terminal)
 *   2. Zoom meeting deleted (if zoomMeetingId present)
 *   3. zoomJoinUrl / zoomHostUrl / zoomStartUrl nulled
 *
 * Idempotent: a duplicate event finds the booking already terminal and skips
 * the status transition. Transient cascade failures reject the event so
 * BullMQ retries with the stored Zoom identifier still available.
 */
@Injectable()
export class RefundCompletedEventHandler {
  private readonly logger = new Logger(RefundCompletedEventHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly zoomMeetingService: ZoomMeetingService,
    private readonly cls: ClsService,
  ) {}

  register(): void {
    this.eventBus.subscribe<RefundCompletedPayload>(
      'finance.refund.completed',
      'bookings.refund-completed.v1',
      async (envelope) => {
        const { bookingId, refundRequestId } = envelope.payload;
        if (!bookingId) {
          this.logger.log(`Refund ${refundRequestId} has no bookingId — package-purchase refund, skipping cascade`);
          return;
        }

        const booking = await this.cls.run(async () => {
          this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
          return this.prisma.booking.findFirst({
            where: { id: bookingId },
            select: {
              id: true,
              status: true,
              zoomMeetingId: true,
            },
          });
        });
        if (!booking) {
          // A duplicate event after the booking was deleted is benign. Any
          // database error above is allowed to reject so BullMQ can retry it.
          this.logger.warn(`Refund ${refundRequestId}: booking ${bookingId} not found — skipping cascade`);
          return;
        }

        const alreadyTerminal =
          booking.status === 'CANCELLED'
          || booking.status === 'NO_SHOW'
          || booking.status === 'COMPLETED'
          || booking.status === 'EXPIRED';
        if (!alreadyTerminal) {
          let nextStatus;
          try {
            nextStatus = assertTransition(booking.status, 'DIRECT_CANCEL');
          } catch (transitionErr) {
            // Invalid lifecycle state is a benign duplicate/final-state event.
            // Only this domain validation is swallowed; transaction/provider
            // failures below must reject for BullMQ retry.
            this.logger.warn(
              `Refund ${refundRequestId}: booking ${bookingId} status '${booking.status}' does not allow DIRECT_CANCEL — leaving status alone`,
              transitionErr instanceof Error ? transitionErr.message : String(transitionErr),
            );
          }
          if (nextStatus) {
            await this.cls.run(async () => {
              this.cls.set('tenant', {
                organizationId: DEFAULT_ORG_ID,
                id: 'system',
                role: 'system',
                isSuperAdmin: false,
              });
              await this.rlsTransaction.withTransaction(async (tx) => {
                // The pre-transaction read only selects the intended transition.
                // A cancellation/expiry may win the race before this transaction
                // starts, so guard the write with the observed status and log it
                // only when this handler actually changed the row.
                const transitioned = await tx.booking.updateMany({
                  where: { id: bookingId, status: booking.status },
                  data: {
                    status: nextStatus,
                    cancelledAt: new Date(),
                    cancelReason: 'OTHER',
                  },
                });
                if (transitioned.count === 1) {
                  await tx.bookingStatusLog.create({
                    data: {
                      bookingId,
                      fromStatus: booking.status,
                      toStatus: nextStatus,
                      changedBy: 'system',
                      reason: `refund:${refundRequestId}`,
                    },
                  });
                }
              });
            });
          }
        }

        // Provider cleanup is part of the retryable cascade. Keep the stored
        // meeting id when deletion fails so the next delivery can retry the
        // same cleanup target; clear all URLs only after a successful delete.
        if (booking.zoomMeetingId) {
          await this.zoomMeetingService.deleteMeetingStrict(DEFAULT_ORG_ID, booking.zoomMeetingId);
          await this.cls.run(async () => {
            this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
            await this.prisma.booking.update({
              where: { id: bookingId },
              data: {
                zoomMeetingId: null,
                zoomJoinUrl: null,
                zoomHostUrl: null,
                zoomStartUrl: null,
              },
            });
          });
        }
      },
    );
  }
}
