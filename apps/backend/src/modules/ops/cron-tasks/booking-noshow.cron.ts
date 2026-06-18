import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_BOOKING_SETTINGS } from '../../bookings/get-booking-settings/get-booking-settings.handler';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';
import { NoShowBookingHandler } from '../../bookings/no-show-booking/no-show-booking.handler';

const CRON_ACTOR = 'system:booking-noshow-cron';
const BATCH_SIZE = 100;

@Injectable()
export class BookingNoShowCron {
  private readonly logger = new Logger(BookingNoShowCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly noShowHandler: NoShowBookingHandler,
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

      // Snapshot the matching ids first so we can process each one through
      // NoShowBookingHandler, which handles the full lifecycle including group
      // session capacity recalculation and GroupEnrollment cleanup.
      const targets = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          scheduledAt: { lte: cutoff },
          checkedInAt: null,
        },
        select: { id: true },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
      });

      if (targets.length === 0) return;

      let succeeded = 0;
      for (const target of targets) {
        try {
          await this.noShowHandler.execute({ bookingId: target.id, changedBy: CRON_ACTOR });
          succeeded += 1;
        } catch (err) {
          // Booking may have transitioned (e.g., late check-in) between select
          // and the handler's fetchBookingOrFail — skip and continue.
          this.logger.warn(
            `booking-noshow: skipped ${target.id} (already transitioned): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      this.logger.log(`marked ${succeeded}/${targets.length} as NO_SHOW`);
    });
  }
}
