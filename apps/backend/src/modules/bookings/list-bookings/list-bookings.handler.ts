import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListBookingsDto } from './list-bookings.dto';
import { mapBookingRow, type BookingRelations } from '../booking-row.mapper';

export type ListBookingsQuery = Omit<ListBookingsDto, 'page' | 'limit' | 'fromDate' | 'toDate'> & {
  page: number;
  limit: number;
  fromDate?: Date;
  toDate?: Date;
  role?: string | null;
  userId?: string;
};

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
      }),
      this.prisma.booking.count({ where }),
    ]);

    const relations = await loadRelations(this.prisma, items);

    return toListResponse(
      items.map((row) => mapBookingRow(row, relations)),
      total,
      query.page,
      query.limit,
    );
  }
}

async function loadRelations(
  prisma: PrismaService,
  rows: { id: string; clientId: string; employeeId: string; serviceId: string | null }[],
): Promise<BookingRelations> {
  const bookingIds = rows.map((r) => r.id);
  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
  const serviceIds = [...new Set(rows.map((r) => r.serviceId).filter((id): id is string => id !== null))];

  const [clients, employees, services, invoices] = await Promise.all([
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
  ]);

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

  return {
    clientsById: new Map(clients.map((c) => [c.id, c])),
    employeesById: new Map(employees.map((e) => [e.id, e])),
    servicesById: new Map(services.map((s) => [s.id, s])),
    paymentsByBookingId,
    invoicesByBookingId,
  };
}
