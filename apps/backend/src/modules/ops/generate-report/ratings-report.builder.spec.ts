import { buildRatingsReport } from './ratings-report.builder';

function makePrisma() {
  return {
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    rating: { findMany: jest.fn().mockResolvedValue([]) },
    client: { findMany: jest.fn().mockResolvedValue([]) },
    employee: { findMany: jest.fn().mockResolvedValue([]) },
    service: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildRatingsReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns zero state with full distribution when no ratings', async () => {
    const result = await buildRatingsReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.averageScore).toBe(0);
    expect(result.totalRatings).toBe(0);
    expect(result.positiveCount).toBe(0);
    expect(result.negativeCount).toBe(0);
    expect(result.distribution).toHaveLength(5);
    expect(result.distribution.every((d) => d.count === 0)).toBe(true);
    expect(result.recentNegative).toEqual([]);
  });

  it('computes average + counts + distribution', async () => {
    prisma.rating.findMany.mockResolvedValue([
      { id: 'r1', bookingId: 'b1', score: 5, comment: 'great', createdAt: new Date('2025-01-10'), clientId: 'c1', employeeId: 'e1' },
      { id: 'r2', bookingId: 'b2', score: 4, comment: null, createdAt: new Date('2025-01-11'), clientId: 'c2', employeeId: 'e1' },
      { id: 'r3', bookingId: 'b3', score: 2, comment: 'meh', createdAt: new Date('2025-01-12'), clientId: 'c3', employeeId: 'e2' },
      { id: 'r4', bookingId: 'b4', score: 1, comment: 'bad', createdAt: new Date('2025-01-13'), clientId: 'c4', employeeId: 'e2' },
    ]);
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b3', serviceId: 's1' },
      { id: 'b4', serviceId: 's1' },
    ]);
    prisma.client.findMany.mockResolvedValue([
      { id: 'c3', name: 'C', firstName: 'C', lastName: null },
      { id: 'c4', name: 'D', firstName: null, lastName: null },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e2', name: 'Em', nameAr: 'أم' },
    ]);
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', nameAr: 'خدمة', nameEn: 'Svc' },
    ]);

    const result = await buildRatingsReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.totalRatings).toBe(4);
    expect(result.averageScore).toBeCloseTo(3); // (5+4+2+1)/4
    expect(result.positiveCount).toBe(2);
    expect(result.negativeCount).toBe(2);
    const dist5 = result.distribution.find((d) => d.score === 5);
    expect(dist5?.count).toBe(1);
    expect(result.recentNegative).toHaveLength(2);
    expect(result.recentNegative[0].employeeName).toBe('أم');
  });
});
