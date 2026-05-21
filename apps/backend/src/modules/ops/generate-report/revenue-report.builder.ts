import { PrismaService } from '../../../infrastructure/database';
import { PaymentStatus, Prisma } from '@prisma/client';

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

  // All aggregation done in Prisma.Decimal to avoid float drift across many payments
  let totalRevenueDecimal = new Prisma.Decimal(0);
  for (const p of payments) {
    totalRevenueDecimal = totalRevenueDecimal.plus(new Prisma.Decimal(p.amount.toString()));
  }

  // By method (Decimal accumulation)
  const methodMapDec = new Map<string, { amountDec: Prisma.Decimal; count: number }>();
  for (const p of payments) {
    const existing = methodMapDec.get(p.method) ?? { amountDec: new Prisma.Decimal(0), count: 0 };
    methodMapDec.set(p.method, {
      amountDec: existing.amountDec.plus(new Prisma.Decimal(p.amount.toString())),
      count: existing.count + 1,
    });
  }

  // By day (Decimal accumulation)
  const dayMapDec = new Map<string, { amountDec: Prisma.Decimal; count: number }>();
  for (const p of payments) {
    const day = p.createdAt.toISOString().slice(0, 10);
    const existing = dayMapDec.get(day) ?? { amountDec: new Prisma.Decimal(0), count: 0 };
    dayMapDec.set(day, {
      amountDec: existing.amountDec.plus(new Prisma.Decimal(p.amount.toString())),
      count: existing.count + 1,
    });
  }

  const totalRevenue = totalRevenueDecimal.toNumber();

  // averagePerBooking: Decimal division → round to whole halalas → convert to number for DTO
  const averagePerBooking =
    totalBookings > 0
      ? totalRevenueDecimal
          .div(new Prisma.Decimal(totalBookings))
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          .toNumber()
      : 0;

  return {
    totalRevenue,
    totalBookings,
    averagePerBooking,
    byMethod: [...methodMapDec.entries()].map(([method, v]) => ({
      method,
      amount: v.amountDec.toNumber(),
      count: v.count,
    })),
    byDay: [...dayMapDec.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, amount: v.amountDec.toNumber(), count: v.count })),
  };
}
