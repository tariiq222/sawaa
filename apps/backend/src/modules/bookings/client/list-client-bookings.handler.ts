import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database';
import { buildClientBooking, type ClientBookingEnumCase } from './client-booking.builder';
import type { ClientBookingDto } from './client-booking.dto';

export enum ClientBookingsTab { Upcoming = 'upcoming', Past = 'past', Cancelled = 'cancelled' }

/**
 * How `tab` classifies a booking.
 * - `date` (web): by appointment time, cancelled = CANCELLED/CANCEL_REQUESTED.
 * - `lifecycle` (mobile): by status only, independent of the appointment date.
 */
export type ClientBookingsTabSemantics = 'date' | 'lifecycle';

export interface ListClientBookingsInput {
  clientId: string;
  page?: number;
  pageSize?: number;
  tab?: ClientBookingsTab | `${ClientBookingsTab}`;
  status?: BookingStatus;
  tabSemantics?: ClientBookingsTabSemantics;
  /** Casing of `status` / `deliveryType` on the wire (mobile keeps lower-case). */
  enumCase?: ClientBookingEnumCase;
}

export interface ListClientBookingsResult {
  items: ClientBookingDto[];
  total: number;
  page: number;
  pageSize: number;
}

const LIFECYCLE_PAST = [BookingStatus.COMPLETED, BookingStatus.NO_SHOW];
const LIFECYCLE_CANCELLED = [BookingStatus.CANCELLED, BookingStatus.CANCEL_REQUESTED, BookingStatus.EXPIRED];

@Injectable()
export class ListClientBookingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  /** Positional form kept for internal callers (chat operations). */
  async execute(input: ListClientBookingsInput): Promise<ListClientBookingsResult>;
  async execute(clientId: string, page?: number, pageSize?: number, tab?: ClientBookingsTab): Promise<ListClientBookingsResult>;
  async execute(
    inputOrClientId: ListClientBookingsInput | string,
    page?: number,
    pageSize?: number,
    tab?: ClientBookingsTab,
  ): Promise<ListClientBookingsResult> {
    const input: ListClientBookingsInput = typeof inputOrClientId === 'string'
      ? { clientId: inputOrClientId, page, pageSize, tab }
      : inputOrClientId;
    const { clientId, status, tabSemantics = 'date', enumCase = 'upper' } = input;

    // Clamp pagination: this handler is reachable from client endpoints with
    // raw query strings, so guard against huge/negative values here.
    const safePage = Math.max(1, Math.floor(Number(input.page ?? 1)) || 1);
    const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(input.pageSize ?? 10)) || 10));
    const skip = (safePage - 1) * safePageSize;
    const lifecycle = tabSemantics === 'lifecycle';

    const dateCancelled = [BookingStatus.CANCELLED, BookingStatus.CANCEL_REQUESTED];
    const now = new Date();
    let tabWhere: Prisma.BookingWhereInput = {};
    if (lifecycle) {
      if (input.tab) {
        tabWhere = {
          status: input.tab === ClientBookingsTab.Past ? { in: LIFECYCLE_PAST }
            : input.tab === ClientBookingsTab.Cancelled ? { in: LIFECYCLE_CANCELLED }
            : { notIn: [...LIFECYCLE_PAST, ...LIFECYCLE_CANCELLED] },
        };
      }
    } else if (input.tab === ClientBookingsTab.Cancelled) {
      tabWhere = { status: { in: dateCancelled } };
    } else if (input.tab) {
      tabWhere = {
        status: { notIn: dateCancelled },
        scheduledAt: input.tab === ClientBookingsTab.Upcoming ? { gt: now } : { lte: now },
      };
    }
    // Ownership lives in the where clause; an explicit status filter is ANDed
    // with the tab so it cannot widen it.
    const where: Prisma.BookingWhereInput = {
      clientId,
      ...tabWhere,
      ...(status ? { AND: [{ status }] } : {}),
    };
    const ascending = lifecycle || input.tab === ClientBookingsTab.Upcoming;
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ scheduledAt: ascending ? 'asc' : 'desc' }, { id: 'asc' }],
        skip,
        take: safePageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    if (bookings.length === 0) {
      return { items: [], total, page: safePage, pageSize: safePageSize };
    }

    const employeeIds = [...new Set(bookings.map((b) => b.employeeId))];
    const serviceIds = [...new Set(bookings.map((b) => b.serviceId).filter((id): id is string => id !== null))];
    const branchIds = [...new Set(bookings.map((b) => b.branchId))];
    const bookingIds = bookings.map((b) => b.id);

    const [employees, services, branches, invoices, ratings] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: employeeIds } } }),
      this.prisma.service.findMany({ where: { id: { in: serviceIds } } }),
      this.prisma.branch.findMany({ where: { id: { in: branchIds } } }),
      this.prisma.invoice.findMany({
        where: { bookingId: { in: bookingIds } },
        include: { payments: { orderBy: { createdAt: 'desc' } } },
      }),
      this.prisma.rating.findMany({ where: { bookingId: { in: bookingIds } }, select: { bookingId: true } }),
    ]);

    const employeesById = new Map(employees.map((e) => [e.id, e]));
    const servicesById = new Map(services.map((s) => [s.id, s]));
    const branchesById = new Map(branches.map((b) => [b.id, b]));
    const invoicesByBookingId = new Map(invoices.map((i) => [i.bookingId, i]));
    const ratedBookingIds = new Set(ratings.map((r) => r.bookingId));

    const items = bookings.map((b) => buildClientBooking(b, {
      employee: employeesById.get(b.employeeId),
      service: b.serviceId ? servicesById.get(b.serviceId) : undefined,
      branch: branchesById.get(b.branchId),
      invoice: invoicesByBookingId.get(b.id),
      hasRated: ratedBookingIds.has(b.id),
      enumCase,
    }));

    return { items, total, page: safePage, pageSize: safePageSize };
  }
}
