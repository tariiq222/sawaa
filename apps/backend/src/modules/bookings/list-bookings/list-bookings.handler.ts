import { Injectable } from '@nestjs/common';
import { Prisma, type Booking } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListBookingsDto } from './list-bookings.dto';
import {
  mapBookingRow,
  type BookingPackageFundingRelation,
  type BookingRelations,
} from '../booking-row.mapper';
import type { HistoricalPaymentMetadata } from '../historical-payment.helper';

export type ListBookingsQuery = Omit<ListBookingsDto, 'page' | 'limit' | 'fromDate' | 'toDate'> & {
  page: number;
  limit: number;
  fromDate?: Date;
  toDate?: Date;
  role?: string | null;
  userId?: string;
};

/**
 * Columns the dashboard list actually reads from each Booking row (see
 * mapBookingRow + loadRelations). Excluding the rest of the Booking model from
 * the SELECT keeps the query narrow AND — critically — skips columns that the
 * live local dev DB may not have yet. The Prisma schema adds:
 *   - creationIdempotencyKey + creationRequestHash
 *       (migration 20260813000001_unified_web_chat)
 *   - zoomCreatePhase / zoomCreateLeaseOwner / zoomCreateLeaseExpiresAt /
 *     zoomCreateAttemptCount / zoomSyncRevision / zoomSyncLeaseOwner /
 *     zoomSyncLeaseExpiresAt
 *       (migration 20260813200000_reconcile_appointment_side_effects_safely)
 * Without this select, `prisma.booking.findMany` emits a SELECT that names
 * every Booking column, and Postgres responds with
 * "The column Booking.creationIdempotencyKey does not exist in the current
 *  database" — 500-ing GET /api/v1/dashboard/bookings on every call.
 * Keep this list in sync with `mapBookingRow` if a new Booking field is read.
 */
const BOOKING_LIST_SELECT = {
  id: true,
  bookingNumber: true,
  clientId: true,
  employeeId: true,
  serviceId: true,
  packageCreditId: true,
  bookingType: true,
  deliveryType: true,
  source: true,
  categoryNameSnapshot: true,
  branchNameSnapshot: true,
  durationMinutesSnapshot: true,
  priceSnapshot: true,
  scheduledAt: true,
  endsAt: true,
  status: true,
  isHistoricalImport: true,
  checkedInAt: true,
  notes: true,
  zoomJoinUrl: true,
  zoomHostUrl: true,
  zoomStartUrl: true,
  zoomMeetingStatus: true,
  zoomMeetingError: true,
  cancelReason: true,
  cancelledAt: true,
  confirmedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.BookingSelect;

@Injectable()
export class ListBookingsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListBookingsQuery) {
    let employeeWhere: { employeeId?: string } = {};
    if (query.role === 'EMPLOYEE' && query.userId) {
      const emp = await this.prisma.employee.findFirst({
        where: { userId: query.userId },
        select: { id: true },
      });
      if (!emp) {
        return toListResponse([], 0, query.page, query.limit);
      }
      employeeWhere = { employeeId: emp.id };
    }

    // isGuest filters by the client's acquisition source. Booking has no `client`
    // relation to filter through (only a clientId column), so resolve the matching
    // client IDs first, then constrain bookings to them.
    let sourceClientWhere: Record<string, unknown> = {};
    if (query.isGuest !== undefined) {
      const sourceClients = await this.prisma.client.findMany({
        where: { source: query.isGuest ? 'ONLINE' : { not: 'ONLINE' } },
        select: { id: true },
      });
      sourceClientWhere = { clientId: { in: sourceClients.map((c) => c.id) } };
    }

    const searchTerm = query.search?.trim();

    // Booking has no `client` relation (only a clientId column), so resolve the
    // matching client IDs first (name / phone), then constrain bookings to them —
    // same pattern as sourceClientWhere above.
    let searchClientIds: string[] = [];
    if (searchTerm) {
      const tokens = searchTerm.split(/\s+/).filter(Boolean);
      const orConditions: Prisma.ClientWhereInput[] = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ];
      // Full name spanning firstName + lastName (e.g. "اختبار دفع 13855"):
      // require every token to appear in either name field.
      if (tokens.length > 1) {
        orConditions.push({
          AND: tokens.map((tok) => ({
            OR: [
              { firstName: { contains: tok, mode: 'insensitive' } },
              { lastName: { contains: tok, mode: 'insensitive' } },
            ],
          })),
        });
      }
      const matched = await this.prisma.client.findMany({
        where: { OR: orConditions },
        select: { id: true },
      });
      searchClientIds = matched.map((c) => c.id);
    }

    const where: Record<string, unknown> = {
      ...sourceClientWhere,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...employeeWhere,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.bookingType ? { bookingType: query.bookingType } : {}),
      ...(query.deliveryType ? { deliveryType: query.deliveryType } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.fromDate || query.toDate
        ? { scheduledAt: { gte: query.fromDate, lte: query.toDate } }
        : {}),
      ...(searchTerm
        ? {
            OR: [
              { id: { contains: searchTerm, mode: 'insensitive' as const } },
              ...(searchClientIds.length
                ? [{ clientId: { in: searchClientIds } }]
                : []),
              ...(/^\d+$/.test(searchTerm)
                ? [{ bookingNumber: Number(searchTerm) }]
                : []),
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { scheduledAt: 'asc' },
        // See BOOKING_LIST_SELECT — narrow SELECT keeps the dashboard list
        // independent of columns that may not yet exist on every dev DB.
        select: BOOKING_LIST_SELECT,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const relations = await loadRelations(this.prisma, items);

    return toListResponse(
      // BOOKING_LIST_SELECT returns a strict subset of `Booking`; mapBookingRow
      // only reads the selected fields, so the type narrowing is sound.
      items.map((row) => mapBookingRow(row as Booking, relations)),
      total,
      query.page,
      query.limit,
    );
  }
}

async function loadRelations(
  prisma: PrismaService,
  rows: {
    id: string;
    clientId: string;
    employeeId: string;
    serviceId: string | null;
    packageCreditId: string | null;
    isHistoricalImport: boolean;
  }[],
): Promise<BookingRelations> {
  const bookingIds = rows.map((r) => r.id);
  const historicalBookingIds = rows
    .filter((r) => r.isHistoricalImport)
    .map((r) => r.id);
  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
  const serviceIds = [...new Set(rows.map((r) => r.serviceId).filter((id): id is string => id !== null))];
  const creditIds = [...new Set(rows.map((r) => r.packageCreditId).filter((id): id is string => id !== null))];

  const [clients, employees, services, invoices, historicalRecords, usages, credits] = await Promise.all([
    clientIds.length
      ? prisma.client.findMany({ where: { id: { in: clientIds } } })
      : Promise.resolve([]),
    employeeIds.length
      ? prisma.employee.findMany({ where: { id: { in: employeeIds } } })
      : Promise.resolve([]),
    serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: serviceIds } } })
      : Promise.resolve([]),
    bookingIds.length
      ? prisma.invoice.findMany({
          where: { bookingId: { in: bookingIds } },
          select: {
            id: true,
            bookingId: true,
            subtotal: true,
            vatRate: true,
            total: true,
            status: true,
            payments: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                amount: true,
                refundedAmount: true,
                method: true,
                status: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    historicalBookingIds.length
      ? prisma.legacyImportRecord.findMany({
          where: {
            sourceSystem: 'booknetic',
            entityType: 'APPOINTMENT',
            targetType: 'Booking',
            targetId: { in: historicalBookingIds },
          },
          select: { targetId: true, metadata: true },
        })
      : Promise.resolve([]),
    bookingIds.length && creditIds.length
      ? prisma.packageCreditUsage.findMany({
          where: {
            bookingId: { in: bookingIds },
            creditId: { in: creditIds },
          },
          select: { bookingId: true, creditId: true, status: true },
        })
      : Promise.resolve([]),
    creditIds.length
      ? prisma.packageCredit.findMany({
          where: { id: { in: creditIds } },
          select: { id: true, purchaseId: true },
        })
      : Promise.resolve([]),
  ]);

  const purchaseIds = [...new Set(credits.map((credit) => credit.purchaseId))];
  const purchases = purchaseIds.length
    ? await prisma.packagePurchase.findMany({
        where: { id: { in: purchaseIds } },
        select: { id: true, packageId: true },
      })
    : [];
  const packageIds = [...new Set(purchases.map((purchase) => purchase.packageId))];
  const packages = packageIds.length
    ? await prisma.sessionPackage.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, nameAr: true, nameEn: true },
      })
    : [];

  // Build paymentsByBookingId: bookingId → latest payment (amounts in halalat)
  // Payment.amount is stored as Decimal(12,2) SAR in Prisma.
  // FormattedCurrency on the dashboard expects halalat (SAR × 100).
  const paymentsByBookingId = new Map(
    invoices
      .filter((inv) => inv.bookingId && inv.payments.length > 0)
      .map((inv) => {
        const p = inv.payments[0];
        return [
          inv.bookingId!,
          {
            id: p.id,
            amount: Math.round(Number(p.amount)),         // already halalas
            refundedAmount: Math.round(Number(p.refundedAmount)), // already halalas
            method: p.method as string,
            status: p.status as string,
          },
        ] as const;
      }),
  );

  // Build invoicesByBookingId: bookingId → invoice id + total + outstanding
  // balance (halalat). The dashboard needs invoiceId to apply a discount or
  // record a manual payment against a still-unpaid booking.
  const invoicesByBookingId = new Map(
    invoices
      .filter((inv) => inv.bookingId)
      .map((inv) => {
        const paidHalalas = inv.payments
          .filter((p) => p.status === 'COMPLETED')
          .reduce((sum, p) => sum + Math.round(Number(p.amount)), 0);
        const total = Math.round(Number(inv.total));
        return [
          inv.bookingId!,
          {
            id: inv.id,
            subtotal: Math.round(Number(inv.subtotal)),
            vatRate: Number(inv.vatRate),
            total,
            outstanding: Math.max(0, total - paidHalalas),
            status: inv.status as string,
          },
        ] as const;
      }),
  );

  const usageByBookingId = new Map(
    usages
      .filter((usage) => {
        const row = rows.find((booking) => booking.id === usage.bookingId);
        return row?.packageCreditId === usage.creditId;
      })
      .map((usage) => [usage.bookingId!, usage] as const),
  );
  const creditsById = new Map(credits.map((credit) => [credit.id, credit]));
  const purchasesById = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  const packagesById = new Map(packages.map((pkg) => [pkg.id, pkg]));
  const packageFundingByBookingId = new Map<string, BookingPackageFundingRelation>();
  for (const row of rows) {
    if (!row.packageCreditId) continue;
    const usage = usageByBookingId.get(row.id);
    const credit = creditsById.get(row.packageCreditId);
    const purchase = credit ? purchasesById.get(credit.purchaseId) : undefined;
    const pkg = purchase ? packagesById.get(purchase.packageId) : undefined;
    if (!usage || !credit || !purchase || !pkg) continue;
    packageFundingByBookingId.set(row.id, {
      creditId: credit.id,
      purchaseId: purchase.id,
      packageId: pkg.id,
      packageNameAr: pkg.nameAr,
      packageNameEn: pkg.nameEn ?? null,
      usageStatus: usage.status as 'CONSUMED' | 'RETURNED',
    });
  }

  return {
    clientsById: new Map(clients.map((c) => [c.id, c])),
    employeesById: new Map(employees.map((e) => [e.id, e])),
    servicesById: new Map(services.map((s) => [s.id, s])),
    paymentsByBookingId,
    invoicesByBookingId,
    packageFundingByBookingId,
    historicalPaymentsByBookingId: new Map(
      historicalRecords
        .filter((row) => row.targetId && row.metadata)
        .map((row) => [
          row.targetId!,
          row.metadata as HistoricalPaymentMetadata,
        ]),
    ),
  };
}
