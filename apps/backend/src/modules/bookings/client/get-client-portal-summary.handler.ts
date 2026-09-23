import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ClientPortalSummary {
  totalBookings: number;
  lastVisit: Date | null;
  outstandingBalance: number;
}

@Injectable()
export class GetClientPortalSummaryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(clientId: string): Promise<ClientPortalSummary> {
    const [totalBookings, lastBooking, unpaidInvoices] = await Promise.all([
      this.prisma.booking.count({ where: { clientId } }),
      this.prisma.booking.findFirst({
        where: { clientId, status: BookingStatus.COMPLETED },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          clientId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        },
        _sum: { total: true },
      }),
    ]);

    return {
      totalBookings,
      lastVisit: lastBooking?.scheduledAt ?? null,
      outstandingBalance: Number(unpaidInvoices._sum.total ?? 0),
    };
  }
}
