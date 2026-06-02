import { PrismaService } from '../../../infrastructure/database';
import { BookingStatus, ClientGender, Prisma } from '@prisma/client';

export interface ClientsReportParams {
  from: Date;
  to: Date;
  branchId?: string;
}

type AgeGroup = '<18' | '18-29' | '30-44' | '45-59' | '60+' | 'UNKNOWN';
type GenderKey = ClientGender | 'UNKNOWN';

export interface ClientsReportResult {
  total: number;
  newClients: number;
  returningClients: number;
  retentionRate: number;
  byGender: Array<{ gender: GenderKey; count: number }>;
  byAgeGroup: Array<{ group: AgeGroup; count: number }>;
  topByRevenue: Array<{
    clientId: string;
    name: string;
    bookings: number;
    revenue: number;
  }>;
}

function bucketAge(dob: Date | null): AgeGroup {
  if (!dob) return 'UNKNOWN';
  const ageMs = Date.now() - dob.getTime();
  const years = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 18) return '<18';
  if (years < 30) return '18-29';
  if (years < 45) return '30-44';
  if (years < 60) return '45-59';
  return '60+';
}

export async function buildClientsReport(
  prisma: PrismaService,
  params: ClientsReportParams,
): Promise<ClientsReportResult> {
  const { from, to, branchId } = params;

  const bookingWhere = {
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
  };

  const [bookingsInRange, newClientCount] = await Promise.all([
    prisma.booking.findMany({
      where: bookingWhere,
      select: {
        clientId: true,
        status: true,
        price: true,
      },
    }),
    prisma.client.count({
      where: { createdAt: { gte: from, lte: to } },
    }),
  ]);

  const clientIds = [...new Set(bookingsInRange.map((b) => b.clientId))];
  const total = clientIds.length;

  // Load client records for the set that booked in range (need createdAt + demographics)
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          gender: true,
          dateOfBirth: true,
          createdAt: true,
        },
      })
    : [];

  let returningClients = 0;
  let newWithBookings = 0;
  for (const c of clients) {
    if (c.createdAt < from) returningClients += 1;
    else newWithBookings += 1;
  }
  const retentionRate =
    returningClients + newWithBookings > 0
      ? returningClients / (returningClients + newWithBookings)
      : 0;

  // Gender + age distribution (among clients with bookings in range)
  const genderMap = new Map<GenderKey, number>();
  const ageMap = new Map<AgeGroup, number>();
  for (const c of clients) {
    const g: GenderKey = c.gender ?? 'UNKNOWN';
    genderMap.set(g, (genderMap.get(g) ?? 0) + 1);
    const group = bucketAge(c.dateOfBirth ?? null);
    ageMap.set(group, (ageMap.get(group) ?? 0) + 1);
  }

  // Top 10 by revenue (from completed bookings in range)
  const revenueByClient = new Map<
    string,
    { revenue: Prisma.Decimal; bookings: number }
  >();
  for (const b of bookingsInRange) {
    const entry = revenueByClient.get(b.clientId) ?? {
      revenue: new Prisma.Decimal(0),
      bookings: 0,
    };
    entry.bookings += 1;
    if (b.status === BookingStatus.COMPLETED) {
      entry.revenue = entry.revenue.plus(new Prisma.Decimal(b.price.toString()));
    }
    revenueByClient.set(b.clientId, entry);
  }
  const topIds = [...revenueByClient.entries()]
    .sort(([, a], [, b]) => b.revenue.comparedTo(a.revenue))
    .slice(0, 10)
    .map(([id]) => id);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const topByRevenue = topIds.map((id) => {
    const rec = clientById.get(id);
    const agg = revenueByClient.get(id)!;
    const fullName =
      rec?.firstName || rec?.lastName
        ? [rec?.firstName, rec?.lastName].filter(Boolean).join(' ')
        : rec?.name ?? '';
    return {
      clientId: id,
      name: fullName,
      bookings: agg.bookings,
      revenue: agg.revenue.toNumber(),
    };
  });

  return {
    total,
    newClients: newClientCount,
    returningClients,
    retentionRate,
    byGender: [...genderMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([gender, count]) => ({ gender, count })),
    byAgeGroup: [...ageMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([group, count]) => ({ group, count })),
    topByRevenue,
  };
}
