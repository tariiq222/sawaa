import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_BOOKING_SETTINGS } from '../../bookings/get-booking-settings/get-booking-settings.handler';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';
import { CompleteBookingHandler } from '../../bookings/complete-booking/complete-booking.handler';

const CRON_ACTOR = 'system:booking-autocomplete-cron';
const BATCH_SIZE = 100;

@Injectable()
export class BookingAutocompleteCron {
  private readonly logger = new Logger(BookingAutocompleteCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly completeHandler: CompleteBookingHandler,
  ) {}

  async execute(): Promise<void> {
    await withCronLeader(this.prisma, 'booking-autocomplete', async () => {
      const settings = await this.prisma.bookingSettings.findFirst({
        where: { branchId: null },
        select: { autoCompleteAfterHours: true },
      });
      const hours =
        settings?.autoCompleteAfterHours ?? DEFAULT_BOOKING_SETTINGS.autoCompleteAfterHours;
      const cutoff = new Date(Date.now() - hours * 3_600_000);

      // Snapshot the matching ids first so we can process each one through
      // CompleteBookingHandler, which handles the full lifecycle including
      // invoice creation for pay-at-clinic bookings.
      const targets = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          endsAt: { lte: cutoff },
          checkedInAt: { not: null },
        },
        select: { id: true },
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
      });

      if (targets.length === 0) return;

      let succeeded = 0;
      for (const target of targets) {
        try {
          await this.completeHandler.execute({ bookingId: target.id, changedBy: CRON_ACTOR });
          succeeded += 1;
        } catch (err) {
          // Booking may have transitioned between select and the handler's
          // fetchBookingOrFail — skip and continue.
          this.logger.warn(
            `booking-autocomplete: skipped ${target.id} (already transitioned): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      this.logger.log(`completed ${succeeded}/${targets.length} bookings`);
    });
  }
}
