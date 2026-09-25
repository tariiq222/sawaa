import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database';

export enum ClientBookingsTab { Upcoming = 'upcoming', Past = 'past', Cancelled = 'cancelled' }

interface ClientBookingItem {
  id: string;
  status: string;
  scheduledAt: Date;
  endsAt: Date;
  durationMins: number;
  price: string;
  currency: string;
  serviceName: string;
  serviceNameAr: string | null;
  employeeName: string;
  employeeNameAr: string | null;
  branchName: string;
  branchNameAr: string | null;
  paymentStatus: string;
  invoiceId: string | null;
  invoiceStatus: string | null;
  deliveryType: string;
  zoomJoinUrl: string | null;
  createdAt: Date;
}

export interface ListClientBookingsResult {
  items: ClientBookingItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ListClientBookingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(clientId: string, page = 1, pageSize = 10, tab?: ClientBookingsTab): Promise<ListClientBookingsResult> {
    // Clamp pagination: this handler is reachable from the public /me endpoint
    // with raw query strings, so guard against huge/negative values here.
    const safePage = Math.max(1, Math.floor(Number(page)) || 1);
    const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize)) || 10));
    const skip = (safePage - 1) * safePageSize;

    const cancelled = [BookingStatus.CANCELLED, BookingStatus.CANCEL_REQUESTED];
    const now = new Date();
    const where: Prisma.BookingWhereInput = {
      clientId,
      ...(tab === ClientBookingsTab.Cancelled ? { status: { in: cancelled } }
        : tab ? {
          status: { notIn: cancelled },
          scheduledAt: tab === ClientBookingsTab.Upcoming ? { gt: now } : { lte: now },
        } : {}),
    };
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ scheduledAt: tab === ClientBookingsTab.Upcoming ? 'asc' : 'desc' }, { id: 'asc' }],
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

    const [employees, services, branches, invoices] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: employeeIds } } }),
      this.prisma.service.findMany({ where: { id: { in: serviceIds } } }),
      this.prisma.branch.findMany({ where: { id: { in: branchIds } } }),
      this.prisma.invoice.findMany({ where: { bookingId: { in: bookingIds } } }),
    ]);

    const invoiceIds = invoices.map((i) => i.id);
    const payments = invoiceIds.length > 0
      ? await this.prisma.payment.findMany({ where: { invoiceId: { in: invoiceIds } } })
      : [];

    const employeesById = new Map(employees.map((e) => [e.id, e]));
    const servicesById = new Map(services.map((s) => [s.id, s]));
    const branchesById = new Map(branches.map((b) => [b.id, b]));
    const invoicesByBookingId = new Map(invoices.map((i) => [i.bookingId, i]));
    const paymentsByInvoiceId = new Map(payments.map((p) => [p.invoiceId, p]));

    const items: ClientBookingItem[] = bookings.map((b) => {
      const employee = employeesById.get(b.employeeId);
      const service = b.serviceId ? servicesById.get(b.serviceId) : undefined;
      const branch = branchesById.get(b.branchId);
      const invoice = invoicesByBookingId.get(b.id);
      const payment = invoice ? paymentsByInvoiceId.get(invoice.id) : null;

      return {
        id: b.id,
        status: b.status,
        scheduledAt: b.scheduledAt,
        endsAt: b.endsAt,
        durationMins: b.durationMins,
        price: b.price.toString(),
        currency: b.currency,
        serviceName: service?.nameEn ?? b.serviceNameSnapshot ?? '',
        serviceNameAr: service?.nameAr ?? b.serviceNameSnapshot ?? null,
        employeeName: employee?.name ?? b.employeeNameSnapshot ?? '',
        employeeNameAr: employee?.nameAr ?? b.employeeNameSnapshot ?? null,
        branchName: branch?.nameEn ?? b.branchNameSnapshot ?? '',
        branchNameAr: branch?.nameAr ?? b.branchNameSnapshot ?? null,
        paymentStatus: payment?.status ?? 'UNKNOWN',
        invoiceId: invoice?.id ?? null,
        invoiceStatus: invoice?.status ?? null,
        deliveryType: b.deliveryType,
        zoomJoinUrl: b.zoomJoinUrl ?? null,
        createdAt: b.createdAt,
      };
    });

    return { items, total, page: safePage, pageSize: safePageSize };
  }
}
