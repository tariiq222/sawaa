import { PrismaService } from '../../../infrastructure/database';
import { PaymentStatus } from '@prisma/client';

export interface RevenueReportParams {
  from: Date;
  to: Date;
  branchId?: string;
  employeeId?: string;
}

export interface RevenueReportResult {
  totalRevenue: number;
  totalBookings: number;
  averagePerBooking: number;
  byMethod: Array<{ method: string; amount: number; count: number }>;
  byDay: Array<{ date: string; amount: number; count: number }>;
}

export async function buildRevenueReport(
  prisma: PrismaService,
  params: RevenueReportParams,
): Promise<RevenueReportResult> {
  const { from, to, branchId, employeeId } = params;

  const bookingWhere = {
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };

  const [totalBookings, payments] = await Promise.all([
    prisma.booking.count({ where: bookingWhere }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: PaymentStatus.COMPLETED,
      },
      select: {
        amount: true,
        method: true,
        createdAt: true,
      },
    }),
  ]);

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  // By method
  const methodMap = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const existing = methodMap.get(p.method) ?? { amount: 0, count: 0 };
    methodMap.set(p.method, {
      amount: existing.amount + Number(p.amount),
      count: existing.count + 1,
    });
  }

  // By day
  const dayMap = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const day = p.createdAt.toISOString().slice(0, 10);
    const existing = dayMap.get(day) ?? { amount: 0, count: 0 };
    dayMap.set(day, {
      amount: existing.amount + Number(p.amount),
      count: existing.count + 1,
    });
  }

  return {
    totalRevenue,
    totalBookings,
    averagePerBooking: totalBookings > 0 ? totalRevenue / totalBookings : 0,
    byMethod: [...methodMap.entries()].map(([method, v]) => ({ method, ...v })),
    byDay: [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
  };
}
