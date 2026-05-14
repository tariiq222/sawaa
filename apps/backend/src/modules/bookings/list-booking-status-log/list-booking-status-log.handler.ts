import { Injectable } from '@nestjs/common';
import type { BookingStatusLog } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ListBookingStatusLogQuery {
  bookingId: string;
}

@Injectable()
export class ListBookingStatusLogHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListBookingStatusLogQuery): Promise<BookingStatusLog[]> {
    return this.prisma.bookingStatusLog.findMany({
      where: { bookingId: query.bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
