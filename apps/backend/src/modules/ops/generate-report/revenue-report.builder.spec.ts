import { buildRevenueReport } from './revenue-report.builder';
import { BookingStatus, PaymentStatus } from '@prisma/client';

const from = new Date('2026-01-01');
const to = new Date('2026-01-31');

const buildPrisma = () => ({
  booking: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'b-1', branchId: 'br-1', employeeId: 'e-1', status: BookingStatus.COMPLETED, scheduledAt: new Date('2026-01-10'), price: 300, currency: 'SAR' },
      { id: 'b-2', branchId: 'br-1', employeeId: 'e-2', status: BookingStatus.CANCELLED, scheduledAt: new Date('2026-01-15'), price: 200, currency: 'SAR' },
    ]),
  },
  payment: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'p-1', amount: 300, status: PaymentStatus.COMPLETED, createdAt: new Date('2026-01-10') },
    ]),
  },
});

describe('buildRevenueReport', () => {
  it('returns period with from and to', async () => {
    const prisma = buildPrisma();
    const result = await buildRevenueReport(prisma as never, { from, to });
    expect(result.period.from).toBe(from.toISOString());
    expect(result.period.to).toBe(to.toISOString());
  });

  it('returns summary with totalRevenue and counts', async () => {
    const prisma = buildPrisma();
    const result = await buildRevenueReport(prisma as never, { from, to });
    expect(result.summary).toMatchObject({
      totalBookings: expect.any(Number),
      completedBookings: expect.any(Number),
      cancelledBookings: expect.any(Number),
    });
  });

  it('filters by branchId when provided', async () => {
    const prisma = buildPrisma();
    await buildRevenueReport(prisma as never, { from, to, branchId: 'br-1' });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: 'br-1' }) }),
    );
  });

  it('returns byBranch and byEmployee breakdowns', async () => {
    const prisma = buildPrisma();
    const result = await buildRevenueReport(prisma as never, { from, to });
    expect(Array.isArray(result.byBranch)).toBe(true);
    expect(Array.isArray(result.byEmployee)).toBe(true);
  });
});