import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { DEFAULT_ORG_ID } from '../../../common/constants';

interface PaymentCompletedPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string;
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
      async (envelope) => {
        const { bookingId, paymentId } = envelope.payload;
        try {
          const booking = await this.cls.run(async () => {
            this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
            return this.prisma.booking.findFirst({ where: { id: bookingId } });
          });
          if (!booking) return;
          if (booking.status !== 'PENDING' && booking.status !== 'AWAITING_PAYMENT') return;

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
                data: { status: 'CONFIRMED', confirmedAt: new Date() },
              }),
              tx.bookingStatusLog.create({
                data: {
                  bookingId,
                  fromStatus: booking.status,
                  toStatus: 'CONFIRMED',
                  changedBy: 'system',
                  reason: `payment:${paymentId}`,
                },
              }),
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
