import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ExpireBookingHandler } from '../../bookings/expire-booking/expire-booking.handler';

import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

const CRON_ACTOR = 'system:booking-expiry-cron';
const BATCH_SIZE = 100;

@Injectable()
export class BookingExpiryCron {
  private readonly logger = new Logger(BookingExpiryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expireBooking: ExpireBookingHandler,
  ) {}

  async execute(): Promise<void> {
    this.logger.log('booking-expiry tick');

    await withCronLeader(this.prisma, 'booking-expiry', async () => {
      const now = new Date();
      const stale = await this.prisma.booking.findMany({
        where: {
          expiresAt: { lt: now },
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.AWAITING_PAYMENT,
            ],
          },
        },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (stale.length === 0) return;

      const results = await Promise.allSettled(
        stale.map((b) =>
          this.expireBooking.execute({ bookingId: b.id, changedBy: CRON_ACTOR }),
        ),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        for (const result of results) {
          if (result.status === 'rejected') {
            this.logger.error('Failed to expire a booking', result.reason);
          }
        }
      }

      this.logger.log(
        `booking-expiry: expired ${succeeded}/${stale.length} bookings` +
          (failed > 0 ? ` (${failed} failed)` : ''),
      );
    });
  }
}
