import { PrismaService } from '../../../infrastructure/database';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';

export interface OverviewReportParams {
  from: Date;
  to: Date;
  branchId?: string;
}

export interface OverviewReportResult {
  totalRevenue: number;
  totalBookings: number;
  completedBookings: number;
  completionRate: number;
  newClients: number;
  trend: Array<{ date: string; revenue: number; bookings: number }>;
  topServices: Array<{
    serviceId: string;
    nameAr: string;
    nameEn: string | null;
    count: number;
  }>;
  topPractitioners: Array<{
    employeeId: string;
    name: string;
    revenue: number;
    bookings: number;
  }>;
}

export async function buildOverviewReport(
  prisma: PrismaService,
  params: OverviewReportParams,
): Promise<OverviewReportResult> {
  const { from, to, branchId } = params;

  const bookingWhere = {
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
  };

  const [
    bookings,
    statusGroups,
    newClients,
    payments,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: bookingWhere,
      select: {
        id: true,
        serviceId: true,
        employeeId: true,
        scheduledAt: true,
        status: true,
        price: true,
      },
    }),
    prisma.booking.groupBy({
      by: ['status'],
      where: bookingWhere,
      _count: { status: true },
    }),
    prisma.client.count({
      where: { createdAt: { gte: from, lte: to } },
    }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: PaymentStatus.COMPLETED,
      },
      select: { amount: true, createdAt: true, invoiceId: true },
    }),
  ]);

  const totalBookings = bookings.length;
  const completedBookings =
    statusGroups.find((g) => g.status === BookingStatus.COMPLETED)?._count
      .status ?? 0;
  const completionRate =
    totalBookings > 0 ? completedBookings / totalBookings : 0;

  // Revenue from COMPLETED payments
  let totalRevenueDec = new Prisma.Decimal(0);
  for (const p of payments) {
    totalRevenueDec = totalRevenueDec.plus(new Prisma.Decimal(p.amount.toString()));
  }
  const totalRevenue = totalRevenueDec.toNumber();

  // Trend: bookings count by day + revenue by day (revenue from payments, bookings from bookings)
  const trendMap = new Map<string, { revenue: Prisma.Decimal; bookings: number }>();
  for (const b of bookings) {
    const day = b.scheduledAt.toISOString().slice(0, 10);
    const entry = trendMap.get(day) ?? {
      revenue: new Prisma.Decimal(0),
      bookings: 0,
    };
    entry.bookings += 1;
    trendMap.set(day, entry);
  }
  for (const p of payments) {
    const day = p.createdAt.toISOString().slice(0, 10);
    const entry = trendMap.get(day) ?? {
      revenue: new Prisma.Decimal(0),
      bookings: 0,
    };
    entry.revenue = entry.revenue.plus(new Prisma.Decimal(p.amount.toString()));
    trendMap.set(day, entry);
  }

  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      revenue: v.revenue.toNumber(),
      bookings: v.bookings,
    }));

  // Top services (by booking count)
  const serviceCount = new Map<string, number>();
  for (const b of bookings) {
    serviceCount.set(b.serviceId, (serviceCount.get(b.serviceId) ?? 0) + 1);
  }
  const topServiceIds = [...serviceCount.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([id]) => id);
  const serviceRecords = topServiceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: topServiceIds } },
        select: { id: true, nameAr: true, nameEn: true },
      })
    : [];
  const serviceById = new Map(serviceRecords.map((s) => [s.id, s]));
  const topServices = topServiceIds.map((id) => {
    const rec = serviceById.get(id);
    return {
      serviceId: id,
      nameAr: rec?.nameAr ?? '',
      nameEn: rec?.nameEn ?? null,
      count: serviceCount.get(id) ?? 0,
    };
  });

  // Top practitioners (by revenue from completed bookings)
  const empAgg = new Map<string, { revenue: Prisma.Decimal; bookings: number }>();
  for (const b of bookings) {
    const entry = empAgg.get(b.employeeId) ?? {
      revenue: new Prisma.Decimal(0),
      bookings: 0,
    };
    entry.bookings += 1;
    if (b.status === BookingStatus.COMPLETED) {
      entry.revenue = entry.revenue.plus(new Prisma.Decimal(b.price.toString()));
    }
    empAgg.set(b.employeeId, entry);
  }
  const topEmpIds = [...empAgg.entries()]
    .sort(([, a], [, b]) => b.revenue.comparedTo(a.revenue))
    .slice(0, 3)
    .map(([id]) => id);
  const empRecords = topEmpIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: topEmpIds } },
        select: { id: true, name: true, nameAr: true },
      })
    : [];
  const empById = new Map(empRecords.map((e) => [e.id, e]));
  const topPractitioners = topEmpIds.map((id) => {
    const rec = empById.get(id);
    const agg = empAgg.get(id)!;
    return {
      employeeId: id,
      name: rec?.nameAr ?? rec?.name ?? '',
      revenue: agg.revenue.toNumber(),
      bookings: agg.bookings,
    };
  });

  return {
    totalRevenue,
    totalBookings,
    completedBookings,
    completionRate,
    newClients,
    trend,
    topServices,
    topPractitioners,
  };
}
