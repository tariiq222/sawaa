import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_BOOKING_SETTINGS } from '../../bookings/get-booking-settings/get-booking-settings.handler';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

@Injectable()
export class BookingAutocompleteCron {
  private readonly logger = new Logger(BookingAutocompleteCron.name);

  constructor(
    private readonly prisma: PrismaService,
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

      const result = await this.prisma.booking.updateMany({
        where: {
          status: BookingStatus.CONFIRMED,
          endsAt: { lte: cutoff },
          checkedInAt: { not: null },
        },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      if (result.count > 0) {
        this.logger.log(`completed ${result.count} bookings`);
      }
    });
  }
}
