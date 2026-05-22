import { PrismaService } from '../../../infrastructure/database';
import { BookingStatus, Prisma } from '@prisma/client';

export interface PractitionersReportParams {
  from: Date;
  to: Date;
  branchId?: string;
  employeeId?: string;
}

export interface PractitionerRow {
  employeeId: string;
  name: string;
  role: string | null;
  bookings: number;
  completedBookings: number;
  completionRate: number;
  revenue: number;
  utilization: number;
  averageRating: number;
}

export interface PractitionersReportResult {
  totalActive: number;
  avgRevenue: number;
  avgUtilization: number;
  avgRating: number;
  totalCompleted: number;
  rows: PractitionerRow[];
}

export interface PractitionerDetailResult extends PractitionerRow {
  byDay: Array<{ date: string; bookings: number; revenue: number }>;
}

export async function buildPractitionersReport(
  prisma: PrismaService,
  params: PractitionersReportParams,
): Promise<PractitionersReportResult> {
  const { from, to, branchId } = params;
  const where = {
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
  };

  const bookings = await prisma.booking.findMany({
    where,
    select: {
      id: true,
      employeeId: true,
      status: true,
      price: true,
      durationMins: true,
    },
  });

  if (bookings.length === 0) {
    return {
      totalActive: 0,
      avgRevenue: 0,
      avgUtilization: 0,
      avgRating: 0,
      totalCompleted: 0,
      rows: [],
    };
  }

  const bookingIds = bookings.map((b) => b.id);
  const employeeIds = [...new Set(bookings.map((b) => b.employeeId))];

  const [employees, ratings] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, nameAr: true, specialty: true, specialtyAr: true },
    }),
    prisma.rating.findMany({
      where: { bookingId: { in: bookingIds } },
      select: { employeeId: true, score: true },
    }),
  ]);

  // Aggregate per employee
  const agg = new Map<
    string,
    {
      bookings: number;
      completed: number;
      revenue: Prisma.Decimal;
      durationMins: number;
      ratingSum: number;
      ratingCount: number;
    }
  >();

  for (const b of bookings) {
    const entry = agg.get(b.employeeId) ?? {
      bookings: 0,
      completed: 0,
      revenue: new Prisma.Decimal(0),
      durationMins: 0,
      ratingSum: 0,
      ratingCount: 0,
    };
    entry.bookings += 1;
    if (b.status === BookingStatus.COMPLETED) {
      entry.completed += 1;
      entry.revenue = entry.revenue.plus(new Prisma.Decimal(b.price.toString()));
      entry.durationMins += b.durationMins;
    }
    agg.set(b.employeeId, entry);
  }

  for (const r of ratings) {
    const entry = agg.get(r.employeeId);
    if (!entry) continue;
    entry.ratingSum += r.score;
    entry.ratingCount += 1;
  }

  const empById = new Map(employees.map((e) => [e.id, e]));

  // Period length in business hours per practitioner (rough): we assume 8h/day × number-of-days
  const days = Math.max(
    1,
    Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const availableMinutesApprox = days * 8 * 60; // 8h workday

  const rows: PractitionerRow[] = [...agg.entries()]
    .map(([id, v]) => {
      const rec = empById.get(id);
      const utilization = availableMinutesApprox > 0
        ? Math.min(1, v.durationMins / availableMinutesApprox)
        : 0;
      return {
        employeeId: id,
        name: rec?.nameAr ?? rec?.name ?? '',
        role: rec?.specialtyAr ?? rec?.specialty ?? null,
        bookings: v.bookings,
        completedBookings: v.completed,
        completionRate: v.bookings > 0 ? v.completed / v.bookings : 0,
        revenue: v.revenue.toNumber(),
        utilization,
        averageRating: v.ratingCount > 0 ? v.ratingSum / v.ratingCount : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalActive = rows.length;
  const totalCompleted = rows.reduce((s, r) => s + r.completedBookings, 0);
  const avgRevenue =
    totalActive > 0 ? Math.round(rows.reduce((s, r) => s + r.revenue, 0) / totalActive) : 0;
  const avgUtilization =
    totalActive > 0 ? rows.reduce((s, r) => s + r.utilization, 0) / totalActive : 0;
  const ratedRows = rows.filter((r) => r.averageRating > 0);
  const avgRating =
    ratedRows.length > 0
      ? ratedRows.reduce((s, r) => s + r.averageRating, 0) / ratedRows.length
      : 0;

  return {
    totalActive,
    avgRevenue,
    avgUtilization,
    avgRating,
    totalCompleted,
    rows,
  };
}

export async function buildPractitionerDetail(
  prisma: PrismaService,
  params: PractitionersReportParams,
): Promise<PractitionerDetailResult | null> {
  const { from, to, branchId, employeeId } = params;
  if (!employeeId) return null;

  const where = {
    employeeId,
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
  };

  const [bookings, employee, ratings] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        price: true,
        durationMins: true,
      },
    }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, nameAr: true, specialty: true, specialtyAr: true },
    }),
    prisma.rating.findMany({
      where: { employeeId, createdAt: { gte: from, lte: to } },
      select: { score: true },
    }),
  ]);

  let totalBookings = 0;
  let completed = 0;
  let revenue = new Prisma.Decimal(0);
  let durationMins = 0;
  const dayMap = new Map<string, { bookings: number; revenue: Prisma.Decimal }>();

  for (const b of bookings) {
    totalBookings += 1;
    const day = b.scheduledAt.toISOString().slice(0, 10);
    const entry = dayMap.get(day) ?? {
      bookings: 0,
      revenue: new Prisma.Decimal(0),
    };
    entry.bookings += 1;
    if (b.status === BookingStatus.COMPLETED) {
      completed += 1;
      revenue = revenue.plus(new Prisma.Decimal(b.price.toString()));
      durationMins += b.durationMins;
      entry.revenue = entry.revenue.plus(new Prisma.Decimal(b.price.toString()));
    }
    dayMap.set(day, entry);
  }

  const days = Math.max(
    1,
    Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const utilization = Math.min(1, durationMins / (days * 8 * 60));
  const ratingSum = ratings.reduce((s, r) => s + r.score, 0);
  const averageRating = ratings.length > 0 ? ratingSum / ratings.length : 0;

  return {
    employeeId,
    name: employee?.nameAr ?? employee?.name ?? '',
    role: employee?.specialtyAr ?? employee?.specialty ?? null,
    bookings: totalBookings,
    completedBookings: completed,
    completionRate: totalBookings > 0 ? completed / totalBookings : 0,
    revenue: revenue.toNumber(),
    utilization,
    averageRating,
    byDay: [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        bookings: v.bookings,
        revenue: v.revenue.toNumber(),
      })),
  };
}
