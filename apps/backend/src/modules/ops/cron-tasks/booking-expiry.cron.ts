import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

@Injectable()
export class BookingExpiryCron {
  private readonly logger = new Logger(BookingExpiryCron.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<void> {
    return this.enhancedExpire();
  }

  private async enhancedExpire(): Promise<void> {
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
              BookingStatus.PENDING_GROUP_FILL,
            ],
          },
        },
        select: { id: true, couponCode: true },
      });
      if (stale.length === 0) return;

      const ids = stale.map((b) => b.id);
      await this.prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: { status: BookingStatus.EXPIRED },
      });

      for (const b of stale) {
        if (!b.couponCode) continue;
        await this.prisma.coupon.updateMany({
          where: {
            code: b.couponCode,
            usedCount: { gt: 0 },
          },
          data: { usedCount: { decrement: 1 } },
        });
      }

      this.logger.log(`expired ${ids.length} bookings`);
    });
  }
}
