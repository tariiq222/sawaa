import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { getClientOutstandingBalance } from '../../finance/client-outstanding-balance.helper';

export interface ClientPortalSummary {
  totalBookings: number;
  lastVisit: Date | null;
  /** Remaining payable balance in integer halalas, across all invoices. */
  outstandingBalance: number;
}

@Injectable()
export class GetClientPortalSummaryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(clientId: string): Promise<ClientPortalSummary> {
    const [totalBookings, lastBooking, outstandingBalance] = await Promise.all([
      this.prisma.booking.count({ where: { clientId } }),
      this.prisma.booking.findFirst({
        where: { clientId, status: BookingStatus.COMPLETED },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
      }),
      getClientOutstandingBalance(this.prisma, clientId),
    ]);

    return {
      totalBookings,
      lastVisit: lastBooking?.scheduledAt ?? null,
      outstandingBalance,
    };
  }
}
