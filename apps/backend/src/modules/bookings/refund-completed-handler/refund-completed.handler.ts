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
 * Idempotent: a duplicate event finds the booking already CANCELLED and skips.
 * Errors do not block the refund — that already happened — but are logged.
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
      async (envelope) => {
        const { bookingId, refundRequestId } = envelope.payload;
        if (!bookingId) {
          this.logger.log(`Refund ${refundRequestId} has no bookingId — bundle-purchase refund, skipping cascade`);
          return;
        }

        try {
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
            this.logger.warn(`Refund ${refundRequestId}: booking ${bookingId} not found — skipping cascade`);
            return;
          }
          if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW' || booking.status === 'COMPLETED') {
            // Already in a terminal state. Still attempt zoom teardown below
            // — receipts may have outlived the cancel flow.
          } else {
            try {
              const nextStatus = assertTransition(booking.status, 'DIRECT_CANCEL');
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
                    data: {
                      status: nextStatus,
                      cancelledAt: new Date(),
                      cancelReason: 'OTHER',
                    },
                  }),
                  tx.bookingStatusLog.create({
                    data: {
                      bookingId,
                      fromStatus: booking.status,
                      toStatus: nextStatus,
                      changedBy: 'system',
                      reason: `refund:${refundRequestId}`,
                    },
                  }),
                ]));
              });
            } catch (transitionErr) {
              this.logger.warn(
                `Refund ${refundRequestId}: booking ${bookingId} status '${booking.status}' does not allow DIRECT_CANCEL — leaving status alone, still tearing down Zoom`,
                transitionErr instanceof Error ? transitionErr.message : String(transitionErr),
              );
            }
          }

          // Tear down the Zoom meeting last so the join URL stops working
          // even if the status update above failed.
          if (booking.zoomMeetingId) {
            try {
              await this.zoomMeetingService.deleteMeeting(DEFAULT_ORG_ID, booking.zoomMeetingId);
            } catch (zoomErr) {
              this.logger.error(
                `Refund ${refundRequestId}: failed to delete Zoom meeting ${booking.zoomMeetingId} — manual intervention required`,
                zoomErr instanceof Error ? zoomErr.stack : String(zoomErr),
              );
            }
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
        } catch (err) {
          this.logger.error(
            `Refund ${refundRequestId}: cascade for booking ${bookingId} failed`,
            err instanceof Error ? err.stack : String(err),
          );
          // Do NOT rethrow — refund already moved real money, the cascade is
          // best-effort. Reconciliation / human review covers any drift.
        }
      },
    );
  }
}
