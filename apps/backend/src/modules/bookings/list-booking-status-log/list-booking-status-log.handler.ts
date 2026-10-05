import { Injectable, NotFoundException } from '@nestjs/common';
import type { BookingStatusLog } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { assertBookingReadAccess, type BookingReadRequester } from '../booking-read-access.helper';

export interface ListBookingStatusLogQuery extends BookingReadRequester {
  bookingId: string;
}

@Injectable()
export class ListBookingStatusLogHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListBookingStatusLogQuery): Promise<BookingStatusLog[]> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: query.bookingId },
      select: { employeeId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await assertBookingReadAccess(this.prisma, booking, query);
    return this.prisma.bookingStatusLog.findMany({
      where: { bookingId: query.bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
