import { PrismaService } from '../../../infrastructure/database';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { buildBookingsReportQueries } from './revenue-report-query.helper';

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
  const queries = buildBookingsReportQueries(params);
  const [summaryRaw, byStatusRaw, byTypeRaw, byDayRaw, byHourDowRaw, byCancelReasonRaw] =
    await Promise.all([
      prisma.$queryRaw<Array<{ total: unknown; avgDurationMins: unknown }>>(queries.summary),
      prisma.$queryRaw<Array<{ status: string; count: unknown }>>(queries.byStatus),
      prisma.$queryRaw<Array<{ type: string; count: unknown }>>(queries.byType),
      prisma.$queryRaw<Array<{ date: string; count: unknown }>>(queries.byDay),
      prisma.$queryRaw<Array<{ dow: unknown; hour: unknown; count: unknown }>>(queries.byHourDow),
      prisma.$queryRaw<Array<{ reason: string; count: unknown }>>(queries.byCancelReason),
    ]);

  const summary = summaryRaw[0] ?? { total: 0, avgDurationMins: 0 };
  const total = Number(summary.total ?? 0);
  const asInt = (value: unknown) =>
    typeof value === 'bigint' ? Number(value) : Number(value ?? 0);

  // No-show / cancel rates
  const noShowCount = asInt(byStatusRaw.find((s) => s.status === BookingStatus.NO_SHOW)?.count);
  const cancelCount = asInt(byStatusRaw.find((s) => s.status === BookingStatus.CANCELLED)?.count);
  const noShowRate = total > 0 ? noShowCount / total : 0;
  const cancelRate = total > 0 ? cancelCount / total : 0;

  return {
    total,
    byStatus: byStatusRaw.map((s) => ({
      status: s.status as BookingStatus,
      count: asInt(s.count),
    })),
    byType: byTypeRaw.map((t) => ({ type: t.type, count: asInt(t.count) })),
    byDay: byDayRaw.map((row) => ({ date: row.date, count: asInt(row.count) })),
    noShowRate,
    cancelRate,
    avgDurationMins: asInt(summary.avgDurationMins),
    byHourDow: byHourDowRaw.map((row) => ({
      dow: asInt(row.dow),
      hour: asInt(row.hour),
      count: asInt(row.count),
    })),
    byCancelReason: byCancelReasonRaw.map((row) => ({
      reason: row.reason as CancellationReason | 'UNSPECIFIED',
      count: asInt(row.count),
    })),
  };
}
