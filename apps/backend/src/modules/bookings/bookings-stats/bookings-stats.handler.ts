import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { todayRangeInTz } from '../../../common/helpers/date-tz.helper';

export interface BookingsStatsResult {
  todayCount: number;
  pendingCount: number;
  completedToday: number;
  revenueToday: number;
}

@Injectable()
export class BookingsStatsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<BookingsStatsResult> {
    const { start: startOfDay, end: endOfDay } = todayRangeInTz();
    const todayRange = { gte: startOfDay, lt: endOfDay };

    const [todayCount, pendingCount, completedToday, revenueAgg] = await Promise.all([
      this.prisma.booking.count({ where: { scheduledAt: todayRange } }),
      this.prisma.booking.count({ where: { status: { in: ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'] }, scheduledAt: todayRange } }),
      this.prisma.booking.count({ where: { status: 'COMPLETED', scheduledAt: todayRange } }),
      this.prisma.booking.aggregate({
        where: { status: 'COMPLETED', scheduledAt: todayRange },
        _sum: { price: true },
      }),
    ]);

    // Booking.price is stored in halalas; revenueToday is returned in halalas.
    // The dashboard converts to a SAR display string at render time.
    const rawRevenue = revenueAgg._sum.price;
    const revenueHalalas = rawRevenue instanceof Prisma.Decimal
      ? rawRevenue.toNumber()
      : Number(rawRevenue ?? 0);

    return {
      todayCount,
      pendingCount,
      completedToday,
      revenueToday: Math.round(revenueHalalas),
    };
  }
}
