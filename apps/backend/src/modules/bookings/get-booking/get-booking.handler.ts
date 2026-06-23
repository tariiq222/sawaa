import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { mapBookingRow, type BookingRelations } from '../booking-row.mapper';

export interface GetBookingQuery {
  bookingId: string;
  clientId?: string;
  /**
   * Caller identity for role-based ownership scoping (dashboard).
   *
   * When `role === 'EMPLOYEE'`, the booking is only returned if it is assigned
   * to the employee resolved from `userId` — mirroring the EMPLOYEE scoping in
   * list-bookings.handler. Privileged roles (OWNER/ADMIN/RECEPTIONIST/etc.) pass
   * no role here and keep full read access. AUTHZ-005.
   */
  role?: string | null;
  userId?: string;
}

@Injectable()
export class GetBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBookingQuery) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: query.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${query.bookingId} not found`);
    }
    if (query.clientId && booking.clientId !== query.clientId) {
      throw new ForbiddenException('Not your booking');
    }
    // AUTHZ-005: a counselor (EMPLOYEE) may only read bookings assigned to them.
    // Resolve their Employee.id from the JWT user id (Booking.employeeId is an
    // Employee.id, not a User.id) and reject access to any other employee's
    // booking. Other dashboard roles are unaffected.
    if (query.role === 'EMPLOYEE' && query.userId) {
      const emp = await this.prisma.employee.findFirst({
        where: { userId: query.userId },
        select: { id: true },
      });
      if (!emp || booking.employeeId !== emp.id) {
        throw new ForbiddenException('Booking is not assigned to you');
      }
    }

    const [client, employee, service, invoice] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: booking.clientId } }),
      this.prisma.employee.findFirst({ where: { id: booking.employeeId } }),
      booking.serviceId ? this.prisma.service.findFirst({ where: { id: booking.serviceId } }) : Promise.resolve(null),
      this.prisma.invoice.findFirst({
        where: { bookingId: booking.id },
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
      }),
    ]);

    // Build paymentsByBookingId for this single booking
    // Payment.amount is Decimal(12,2) SAR → convert to halalat (× 100)
    const paymentsByBookingId = new Map<string, {
      id: string;
      amount: number;
      refundedAmount: number;
      method: string;
      status: string;
    }>();
    if (invoice && invoice.payments.length > 0) {
      const p = invoice.payments[0];
      paymentsByBookingId.set(booking.id, {
        id: p.id,
        amount: Math.round(Number(p.amount)),
        refundedAmount: Math.round(Number(p.refundedAmount)),
        method: p.method as string,
        status: p.status as string,
      });
    }

    const invoicesByBookingId = new Map<string, {
      id: string;
      subtotal: number;
      vatRate: number;
      total: number;
      outstanding: number;
      status: string;
    }>();
    if (invoice) {
      const paidHalalas = invoice.payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + Math.round(Number(p.amount)), 0);
      const total = Math.round(Number(invoice.total));
      invoicesByBookingId.set(booking.id, {
        id: invoice.id,
        subtotal: Math.round(Number(invoice.subtotal)),
        vatRate: Number(invoice.vatRate),
        total,
        outstanding: Math.max(0, total - paidHalalas),
        status: invoice.status as string,
      });
    }

    const relations: BookingRelations = {
      clientsById: new Map(client ? [[client.id, client]] : []),
      employeesById: new Map(employee ? [[employee.id, employee]] : []),
      servicesById: new Map(service ? [[service.id, service]] : []),
      paymentsByBookingId,
      invoicesByBookingId,
    };

    return mapBookingRow(booking, relations);
  }
}
