import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { mapBookingRow, type BookingRelations } from '../booking-row.mapper';

@Injectable()
export class GetClientBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(bookingId: string, clientId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, clientId },
      include: {
        groupSession: true,
        groupEnrollment: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const [client, employee, service, branch] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: booking.clientId } }),
      this.prisma.employee.findFirst({ where: { id: booking.employeeId } }),
      this.prisma.service.findFirst({ where: { id: booking.serviceId } }),
      this.prisma.branch.findFirst({ where: { id: booking.branchId } }),
    ]);

    const relations: BookingRelations = {
      clientsById: new Map(client ? [[client.id, client]] : []),
      employeesById: new Map(employee ? [[employee.id, employee]] : []),
      servicesById: new Map(service ? [[service.id, service]] : []),
    };

    const invoice = await this.prisma.invoice.findFirst({
      where: { bookingId: booking.id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });
    const payment = invoice?.payments[0];

    return {
      id: booking.id,
      status: booking.status,
      scheduledAt: booking.scheduledAt.toISOString(),
      endsAt: booking.endsAt?.toISOString() ?? null,
      durationMins: booking.durationMins,
      price: booking.price.toString(),
      currency: booking.currency,
      serviceId: booking.serviceId,
      serviceName: service?.nameEn ?? service?.nameAr ?? '',
      serviceNameAr: service?.nameAr ?? null,
      employeeName: employee?.name ?? '',
      employeeNameAr: null,
      branchId: booking.branchId,
      branchName: branch?.nameEn ?? branch?.nameAr ?? '',
      branchNameAr: branch?.nameAr ?? null,
      paymentStatus: payment?.status ?? null,
      createdAt: booking.createdAt.toISOString(),
    };
  }
}
