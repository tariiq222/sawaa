import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface BookingStatusResult {
  bookingId: string;
  status: string;
  paymentStatus: string;
}

@Injectable()
export class GetBookingStatusHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(bookingId: string): Promise<BookingStatusResult> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    const payment = await this.prisma.payment.findFirst({
      where: { invoice: { bookingId } },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });

    return {
      bookingId: booking.id,
      status: booking.status,
      paymentStatus: payment?.status ?? 'NONE',
    };
  }
}
