import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

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

    const [_client, employee, service, branch] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: booking.clientId } }),
      this.prisma.employee.findFirst({ where: { id: booking.employeeId } }),
      this.prisma.service.findFirst({ where: { id: booking.serviceId } }),
      this.prisma.branch.findFirst({ where: { id: booking.branchId } }),
    ]);

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
      // Fall back to the snapshot captured at booking time so a later
      // hard-delete of the service/employee/branch does not blank the name.
      serviceName: service?.nameEn ?? service?.nameAr ?? booking.serviceNameSnapshot ?? '',
      serviceNameAr: service?.nameAr ?? booking.serviceNameSnapshot ?? null,
      employeeId: booking.employeeId,
      employeeName: employee?.name ?? booking.employeeNameSnapshot ?? '',
      employeeNameAr: booking.employeeNameSnapshot ?? null,
      branchId: booking.branchId,
      branchName: branch?.nameEn ?? branch?.nameAr ?? booking.branchNameSnapshot ?? '',
      branchNameAr: branch?.nameAr ?? booking.branchNameSnapshot ?? null,
      paymentStatus: payment?.status ?? null,
      invoiceId: invoice?.id ?? null,
      invoiceStatus: invoice?.status ?? null,
      deliveryType: booking.deliveryType,
      zoomJoinUrl: booking.zoomJoinUrl ?? null,
      createdAt: booking.createdAt.toISOString(),
    };
  }
}
