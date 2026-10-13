import { ClientCancellationOutcomeHandler } from './client-cancellation-outcome.handler';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { buildClientBooking, type ClientBookingEnumCase } from './client-booking.builder';
import type { ClientBookingDto } from './client-booking.dto';

@Injectable()
export class GetClientBookingHandler {
  constructor(private readonly prisma: PrismaService, private readonly cancellationOutcome: ClientCancellationOutcomeHandler) {}

  async execute(bookingId: string, clientId: string, options: { enumCase?: ClientBookingEnumCase } = {}): Promise<ClientBookingDto> {
    // Ownership is part of the query: a foreign id is indistinguishable from a
    // missing one (404), on both the web and the mobile route.
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, clientId } });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const [employee, service, branch, invoice, rating] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: booking.employeeId } }),
      booking.serviceId ? this.prisma.service.findFirst({ where: { id: booking.serviceId } }) : Promise.resolve(null),
      this.prisma.branch.findFirst({ where: { id: booking.branchId } }),
      this.prisma.invoice.findFirst({
        where: { bookingId: booking.id },
        include: { payments: { orderBy: { createdAt: 'desc' } } },
      }),
      this.prisma.rating.findUnique({ where: { bookingId: booking.id }, select: { id: true } }),
    ]);

    const dto = buildClientBooking(booking, {
      employee, service, branch, invoice, hasRated: Boolean(rating), enumCase: options.enumCase,
    });
    return booking.status === 'CANCELLED'
      ? { ...dto, cancellationRefund: await this.cancellationOutcome.execute(booking.id, clientId) }
      : dto;
  }
}
