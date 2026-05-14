import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_BOOKING_SETTINGS } from '../../bookings/get-booking-settings/get-booking-settings.handler';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

@Injectable()
export class BookingNoShowCron {
  private readonly logger = new Logger(BookingNoShowCron.name);

  constructor(
    private readonly prisma: PrismaService,
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

      const result = await this.prisma.booking.updateMany({
        where: {
          status: BookingStatus.CONFIRMED,
          scheduledAt: { lte: cutoff },
          checkedInAt: null,
        },
        data: {
          status: BookingStatus.NO_SHOW,
          noShowAt: new Date(),
        },
      });

      if (result.count > 0) {
        this.logger.log(`marked ${result.count} as NO_SHOW`);
      }
    });
  }
}
