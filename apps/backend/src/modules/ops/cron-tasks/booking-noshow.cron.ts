import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { DEFAULT_BOOKING_SETTINGS } from '../../bookings/get-booking-settings/get-booking-settings.handler';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

const CRON_ACTOR = 'system:booking-noshow-cron';
const NOSHOW_REASON = 'Auto no-show: client did not check in within the configured window';
const BATCH_SIZE = 100;

@Injectable()
export class BookingNoShowCron {
  private readonly logger = new Logger(BookingNoShowCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(): Promise<void> {
    await withCronLeader(this.prisma, 'booking-noshow', async () => {
      const settings = await this.prisma.bookingSettings.findFirst({
        where: { branchId: null },
        select: { autoNoShowAfterMinutes: true },
      });
      const minutes =
        settings?.autoNoShowAfterMinutes ?? DEFAULT_BOOKING_SETTINGS.autoNoShowAfterMinutes;
      const cutoff = new Date(Date.now() - minutes * 60_000);

      // Snapshot the matching ids first so we can write a status-log row per
      // booking. updateMany is fast but skips per-row audit; the two-step
      // pattern (select-then-update-each) gives us a proper audit trail.
      const targets = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          scheduledAt: { lte: cutoff },
          checkedInAt: null,
        },
        select: { id: true, status: true },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
      });

      if (targets.length === 0) return;

      const now = new Date();
      let succeeded = 0;
      for (const target of targets) {
        try {
          await this.rlsTransaction.withTransaction(async (tx) => {
            await tx.booking.update({
              where: { id: target.id, status: BookingStatus.CONFIRMED },
              data: { status: BookingStatus.NO_SHOW, noShowAt: now },
            });
            await tx.bookingStatusLog.create({
              data: {
                bookingId: target.id,
                fromStatus: target.status,
                toStatus: BookingStatus.NO_SHOW,
                changedBy: CRON_ACTOR,
                reason: NOSHOW_REASON,
              },
            });
          });
          succeeded += 1;
        } catch (err) {
          // Booking may have transitioned (e.g., late check-in) between select
          // and update — skip and continue.
          this.logger.warn(
            `booking-noshow: skipped ${target.id} (already transitioned): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      this.logger.log(`marked ${succeeded}/${targets.length} as NO_SHOW`);
    });
  }
}
