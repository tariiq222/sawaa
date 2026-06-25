import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY, DEFAULT_ORG_ID } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';
import { updateBookingAtomically } from '../booking-lifecycle.helper';

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
 * DEPOSIT_PAID, reserving the staff time while a balance stays due.
 *
 * Does NOT confirm the appointment and does NOT provision Zoom — the meeting is
 * only created once the booking reaches CONFIRMED (when the remaining balance is
 * settled, which emits PaymentCompletedEvent and runs the confirm path).
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
          if (!booking) return;

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
            await this.rlsTransaction.withTransaction((tx) =>
              Promise.all([
                updateBookingAtomically(tx, {
                  bookingId,
                  currentStatus: booking.status,
                  actionLabel: 'deposit paid',
                  data: { status: nextStatus },
                }),
                tx.bookingStatusLog.create({
                  data: {
                    bookingId,
                    fromStatus: booking.status,
                    toStatus: nextStatus,
                    changedBy: 'system',
                    reason: `deposit:${paymentId}`,
                  },
                }),
              ]),
            );
          });
        } catch (err) {
          this.logger.error(`Failed to mark booking ${bookingId} DEPOSIT_PAID after deposit`, err);
          throw err;
        }
      },
    );
  }
}
