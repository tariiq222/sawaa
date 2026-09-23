import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

const JOINABLE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.DEPOSIT_PAID,
];

@Injectable()
export class GetClientBookingForActionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async executeForJoin(bookingId: string, clientId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId },
      select: {
        id: true,
        clientId: true,
        deliveryType: true,
        status: true,
        zoomJoinUrl: true,
        scheduledAt: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.clientId !== clientId) throw new ForbiddenException('Not your booking');
    if (booking.deliveryType !== DeliveryType.ONLINE && !booking.zoomJoinUrl) {
      throw new ForbiddenException('Join is only available for online bookings');
    }
    if (!JOINABLE_STATUSES.includes(booking.status)) {
      throw new ForbiddenException('Join is not available for this booking');
    }
    return booking;
  }

  async executeForRate(bookingId: string, clientId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId },
      select: { id: true, clientId: true, employeeId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.clientId !== clientId) throw new ForbiddenException('Not your booking');
    return booking;
  }
}
