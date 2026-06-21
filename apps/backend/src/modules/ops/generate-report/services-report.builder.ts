import { PrismaService } from '../../../infrastructure/database';
import { BookingStatus, Prisma } from '@prisma/client';

export interface ServicesReportParams {
  from: Date;
  to: Date;
  branchId?: string;
}

export interface ServicesReportResult {
  rows: Array<{
    serviceId: string;
    nameAr: string;
    nameEn: string | null;
    bookings: number;
    completedBookings: number;
    revenue: number;
    cancelRate: number;
    averageRating: number;
  }>;
}

export async function buildServicesReport(
  prisma: PrismaService,
  params: ServicesReportParams,
): Promise<ServicesReportResult> {
  const { from, to, branchId } = params;

  const bookingWhere = {
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
  };

  const bookings = await prisma.booking.findMany({
    where: bookingWhere,
    select: {
      id: true,
      serviceId: true,
      status: true,
      price: true,
    },
  });

  if (bookings.length === 0) {
    return { rows: [] };
  }

  const bookingIds = bookings.map((b) => b.id);
  const serviceIds = [...new Set(bookings.map((b) => b.serviceId).filter((id): id is string => id !== null))];

  const [services, ratings] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, nameAr: true, nameEn: true },
    }),
    prisma.rating.findMany({
      where: { bookingId: { in: bookingIds } },
      select: { bookingId: true, score: true },
    }),
  ]);

  // Index ratings by bookingId → score
  const ratingByBooking = new Map<string, number>();
  for (const r of ratings) ratingByBooking.set(r.bookingId, r.score);

  // Group bookings by service
  const agg = new Map<
    string,
    {
      bookings: number;
      completed: number;
      cancelled: number;
      revenue: Prisma.Decimal;
      ratingSum: number;
      ratingCount: number;
    }
  >();

  for (const b of bookings) {
    if (!b.serviceId) continue;
    const entry = agg.get(b.serviceId) ?? {
      bookings: 0,
      completed: 0,
      cancelled: 0,
      revenue: new Prisma.Decimal(0),
      ratingSum: 0,
      ratingCount: 0,
    };
    entry.bookings += 1;
    if (b.status === BookingStatus.COMPLETED) {
      entry.completed += 1;
      entry.revenue = entry.revenue.plus(new Prisma.Decimal(b.price.toString()));
    } else if (b.status === BookingStatus.CANCELLED) {
      entry.cancelled += 1;
    }
    const score = ratingByBooking.get(b.id);
    if (typeof score === 'number') {
      entry.ratingSum += score;
      entry.ratingCount += 1;
    }
    agg.set(b.serviceId, entry);
  }

  const serviceById = new Map(services.map((s) => [s.id, s]));

  const rows = [...agg.entries()]
    .map(([serviceId, v]) => {
      const rec = serviceById.get(serviceId);
      return {
        serviceId,
        nameAr: rec?.nameAr ?? '',
        nameEn: rec?.nameEn ?? null,
        bookings: v.bookings,
        completedBookings: v.completed,
        revenue: v.revenue.toNumber(),
        cancelRate: v.bookings > 0 ? v.cancelled / v.bookings : 0,
        averageRating:
          v.ratingCount > 0 ? v.ratingSum / v.ratingCount : 0,
      };
    })
    .sort((a, b) => b.bookings - a.bookings);

  return { rows };
}
