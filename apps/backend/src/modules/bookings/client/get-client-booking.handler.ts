import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetClientBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(bookingId: string, clientId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, clientId },
      include: {
        service: { select: { id: true, nameAr: true, nameEn: true } },
        employee: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
        branch: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return {
      id: booking.id,
      status: booking.status,
      scheduledAt: booking.scheduledAt.toISOString(),
      endsAt: booking.endsAt?.toISOString() ?? null,
      durationMins: booking.durationMins,
      price: booking.price.toString(),
      currency: booking.currency,
      serviceName: booking.service?.nameEn ?? booking.service?.nameAr ?? '',
      serviceNameAr: booking.service?.nameAr ?? null,
      employeeName: booking.employee?.user?.name ?? '',
      employeeNameAr: null,
      branchName: booking.branch?.nameEn ?? booking.branch?.nameAr ?? '',
      branchNameAr: booking.branch?.nameAr ?? null,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt.toISOString(),
    };
  }
}
