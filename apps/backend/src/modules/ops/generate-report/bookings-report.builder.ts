import { PrismaService } from '../../../infrastructure/database';
import { BookingStatus, CancellationReason } from '@prisma/client';

export interface BookingsReportParams {
  from: Date;
  to: Date;
  branchId?: string;
}

export interface BookingsReportResult {
  total: number;
  byStatus: Array<{ status: BookingStatus; count: number }>;
  byType: Array<{ type: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
  noShowRate: number;
  cancelRate: number;
  avgDurationMins: number;
  byHourDow: Array<{ dow: number; hour: number; count: number }>;
  byCancelReason: Array<{ reason: CancellationReason | 'UNSPECIFIED'; count: number }>;
}

export async function buildBookingsReport(
  prisma: PrismaService,
  params: BookingsReportParams,
): Promise<BookingsReportResult> {
  const { from, to, branchId } = params;
  const where = {
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
  };

  const [total, byStatusRaw, byTypeRaw, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    }),
    prisma.booking.groupBy({
      by: ['bookingType'],
      where,
      _count: { bookingType: true },
    }),
    prisma.booking.findMany({
      where,
      select: {
        scheduledAt: true,
        status: true,
        durationMins: true,
        cancelReason: true,
      },
    }),
  ]);

  // By day
  const dayMap = new Map<string, number>();
  for (const b of bookings) {
    const day = b.scheduledAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  // No-show / cancel rates
  const noShowCount = byStatusRaw.find((s) => s.status === BookingStatus.NO_SHOW)?._count.status ?? 0;
  const cancelCount = byStatusRaw.find((s) => s.status === BookingStatus.CANCELLED)?._count.status ?? 0;
  const noShowRate = total > 0 ? noShowCount / total : 0;
  const cancelRate = total > 0 ? cancelCount / total : 0;

  // Average duration
  const durationSum = bookings.reduce((acc, b) => acc + b.durationMins, 0);
  const avgDurationMins = bookings.length > 0 ? Math.round(durationSum / bookings.length) : 0;

  // Heatmap — dow × hour
  const heatmap = new Map<string, number>();
  for (const b of bookings) {
    const dow = b.scheduledAt.getUTCDay();
    const hour = b.scheduledAt.getUTCHours();
    const key = `${dow}:${hour}`;
    heatmap.set(key, (heatmap.get(key) ?? 0) + 1);
  }

  // Cancel reasons
  const reasonMap = new Map<CancellationReason | 'UNSPECIFIED', number>();
  for (const b of bookings) {
    if (b.status !== BookingStatus.CANCELLED) continue;
    const key = b.cancelReason ?? 'UNSPECIFIED';
    reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
  }

  return {
    total,
    byStatus: byStatusRaw.map((s) => ({ status: s.status, count: s._count.status })),
    byType: byTypeRaw.map((t) => ({ type: t.bookingType, count: t._count.bookingType })),
    byDay: [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    noShowRate,
    cancelRate,
    avgDurationMins,
    byHourDow: [...heatmap.entries()].map(([k, count]) => {
      const [dow, hour] = k.split(':').map(Number);
      return { dow, hour, count };
    }),
    byCancelReason: [...reasonMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({ reason, count })),
  };
}
