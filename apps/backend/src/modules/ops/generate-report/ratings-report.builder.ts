import { PrismaService } from '../../../infrastructure/database';

export interface RatingsReportParams {
  from: Date;
  to: Date;
  branchId?: string;
}

export interface RatingsReportResult {
  averageScore: number;
  totalRatings: number;
  positiveCount: number; // score >= 4
  negativeCount: number; // score <= 2
  distribution: Array<{ score: 1 | 2 | 3 | 4 | 5; count: number }>;
  trend: Array<{ date: string; average: number; count: number }>;
  recentNegative: Array<{
    id: string;
    bookingId: string;
    score: number;
    comment: string | null;
    clientName: string;
    employeeName: string;
    serviceName: string;
    createdAt: string;
  }>;
}

export async function buildRatingsReport(
  prisma: PrismaService,
  params: RatingsReportParams,
): Promise<RatingsReportResult> {
  const { from, to, branchId } = params;

  // Ratings are joined to bookings via bookingId. Branch filter requires the booking lookup.
  const bookingFilter = branchId
    ? await prisma.booking
        .findMany({
          where: { branchId, scheduledAt: { gte: from, lte: to } },
          select: { id: true },
        })
        .then((rows) => rows.map((r) => r.id))
    : null;

  const ratingWhere = {
    createdAt: { gte: from, lte: to },
    ...(bookingFilter ? { bookingId: { in: bookingFilter } } : {}),
  };

  const ratings = await prisma.rating.findMany({
    where: ratingWhere,
    select: {
      id: true,
      bookingId: true,
      score: true,
      comment: true,
      createdAt: true,
      clientId: true,
      employeeId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (ratings.length === 0) {
    return {
      averageScore: 0,
      totalRatings: 0,
      positiveCount: 0,
      negativeCount: 0,
      distribution: [1, 2, 3, 4, 5].map((s) => ({
        score: s as 1 | 2 | 3 | 4 | 5,
        count: 0,
      })),
      trend: [],
      recentNegative: [],
    };
  }

  const totalRatings = ratings.length;
  const sum = ratings.reduce((acc, r) => acc + r.score, 0);
  const averageScore = sum / totalRatings;
  const positiveCount = ratings.filter((r) => r.score >= 4).length;
  const negativeCount = ratings.filter((r) => r.score <= 2).length;

  // Distribution
  const distMap = new Map<1 | 2 | 3 | 4 | 5, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ]);
  for (const r of ratings) {
    const k = r.score as 1 | 2 | 3 | 4 | 5;
    distMap.set(k, (distMap.get(k) ?? 0) + 1);
  }
  const distribution = [1, 2, 3, 4, 5].map((s) => ({
    score: s as 1 | 2 | 3 | 4 | 5,
    count: distMap.get(s as 1 | 2 | 3 | 4 | 5) ?? 0,
  }));

  // Trend by day
  const trendMap = new Map<string, { sum: number; count: number }>();
  for (const r of ratings) {
    const day = r.createdAt.toISOString().slice(0, 10);
    const entry = trendMap.get(day) ?? { sum: 0, count: 0 };
    entry.sum += r.score;
    entry.count += 1;
    trendMap.set(day, entry);
  }
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      average: v.sum / v.count,
      count: v.count,
    }));

  // Recent negative — top 10
  const negativeRatings = ratings.filter((r) => r.score <= 3).slice(0, 10);
  const negBookingIds = negativeRatings.map((r) => r.bookingId);
  const negClientIds = [...new Set(negativeRatings.map((r) => r.clientId))];
  const negEmployeeIds = [...new Set(negativeRatings.map((r) => r.employeeId))];

  const [negBookings, negClients, negEmployees] = await Promise.all([
    negBookingIds.length
      ? prisma.booking.findMany({
          where: { id: { in: negBookingIds } },
          select: { id: true, serviceId: true },
        })
      : Promise.resolve([]),
    negClientIds.length
      ? prisma.client.findMany({
          where: { id: { in: negClientIds } },
          select: { id: true, name: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    negEmployeeIds.length
      ? prisma.employee.findMany({
          where: { id: { in: negEmployeeIds } },
          select: { id: true, name: true, nameAr: true },
        })
      : Promise.resolve([]),
  ]);

  const serviceIds = [...new Set(negBookings.map((b) => b.serviceId).filter((id): id is string => id !== null))];
  const negServices = serviceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, nameAr: true, nameEn: true },
      })
    : [];

  const bookingById = new Map(negBookings.map((b) => [b.id, b]));
  const clientById = new Map(negClients.map((c) => [c.id, c]));
  const employeeById = new Map(negEmployees.map((e) => [e.id, e]));
  const serviceById = new Map(negServices.map((s) => [s.id, s]));

  const recentNegative = negativeRatings.map((r) => {
    const c = clientById.get(r.clientId);
    const e = employeeById.get(r.employeeId);
    const b = bookingById.get(r.bookingId);
    const s = b?.serviceId ? serviceById.get(b.serviceId) : undefined;
    const clientName =
      c?.firstName || c?.lastName
        ? [c?.firstName, c?.lastName].filter(Boolean).join(' ')
        : c?.name ?? '';
    return {
      id: r.id,
      bookingId: r.bookingId,
      score: r.score,
      comment: r.comment ?? null,
      clientName,
      employeeName: e?.nameAr ?? e?.name ?? '',
      serviceName: s?.nameAr ?? '',
      createdAt: r.createdAt.toISOString(),
    };
  });

  return {
    averageScore,
    totalRatings,
    positiveCount,
    negativeCount,
    distribution,
    trend,
    recentNegative,
  };
}
