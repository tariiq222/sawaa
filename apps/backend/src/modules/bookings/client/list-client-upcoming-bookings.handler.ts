import { Injectable } from '@nestjs/common';
import { BookingStatus, type Booking } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

const UPCOMING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

export interface ListClientUpcomingBookingsCommand {
  clientId: string;
  page?: number;
  limit?: number;
  now?: Date;
}

export interface ListClientUpcomingBookingsResult {
  data: Booking[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class ListClientUpcomingBookingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListClientUpcomingBookingsCommand): Promise<ListClientUpcomingBookingsResult> {
    const page = cmd.page ?? 1;
    const limit = cmd.limit ?? 10;
    const where = {
      clientId: cmd.clientId,
      scheduledAt: { gte: cmd.now ?? new Date() },
      status: { in: UPCOMING_STATUSES },
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
