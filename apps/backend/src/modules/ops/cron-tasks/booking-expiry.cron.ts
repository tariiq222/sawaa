import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ExpireBookingHandler } from '../../bookings/expire-booking/expire-booking.handler';
import { NULL_EXPIRY_FALLBACK_MS } from '../../bookings/booking-hold-window';

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
      const fallbackCutoff = new Date(now.getTime() - NULL_EXPIRY_FALLBACK_MS);

      // A hold is overdue in two cases:
      //   1. the window stamped at creation elapsed, or
      //   2. it never carried a window at all (rows written before the window
      //      existed, seeded demo data, or any writer outside the two booking
      //      creation paths) and is older than the fallback age.
      // `expiresAt: { lt: now }` never matches NULL, so without case 2 such a
      // row is immortal: the cron cannot see it, staff cannot cancel it, and it
      // keeps blocking the practitioner's slot forever.
      //
      // PENDING_GROUP_FILL and DEPOSIT_PAID are deliberately absent:
      // EXPIRE does not accept PENDING_GROUP_FILL (every tick would fail), and
      // DEPOSIT_PAID keeps the creation window it was stamped with, which must
      // never expire a booking whose deposit was already collected.
      const stale = await this.prisma.booking.findMany({
        where: {
          isHistoricalImport: false,
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.AWAITING_PAYMENT,
            ],
          },
          OR: [
            { expiresAt: { lt: now } },
            { expiresAt: null, createdAt: { lt: fallbackCutoff } },
          ],
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
