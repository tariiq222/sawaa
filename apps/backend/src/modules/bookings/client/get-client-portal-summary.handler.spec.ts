import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetClientPortalSummaryHandler } from './get-client-portal-summary.handler';

describe('GetClientPortalSummaryHandler', () => {
  const prisma = {
    booking: { count: jest.fn(), findFirst: jest.fn() },
    invoice: { aggregate: jest.fn() },
  };
  const handler = new GetClientPortalSummaryHandler(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('returns booking count, last completed visit, and outstanding balance', async () => {
    const lastVisit = new Date('2026-05-01T10:00:00Z');
    prisma.booking.count.mockResolvedValue(8);
    prisma.booking.findFirst.mockResolvedValue({ scheduledAt: lastVisit });
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { total: 250 } });

    await expect(handler.execute('client-1')).resolves.toEqual({
      totalBookings: 8,
      lastVisit,
      outstandingBalance: 250,
    });

    expect(prisma.booking.count).toHaveBeenCalledWith({ where: { clientId: 'client-1' } });
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { clientId: 'client-1', status: BookingStatus.COMPLETED },
      orderBy: { scheduledAt: 'desc' },
      select: { scheduledAt: true },
    });
  });

  it('returns null last visit and zero balance when nothing is owed', async () => {
    prisma.booking.count.mockResolvedValue(0);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { total: null } });

    await expect(handler.execute('client-1')).resolves.toEqual({
      totalBookings: 0,
      lastVisit: null,
      outstandingBalance: 0,
    });
  });
});
