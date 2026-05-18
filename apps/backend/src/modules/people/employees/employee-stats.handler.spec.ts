import { EmployeeStatsHandler } from './employee-stats.handler';

describe('EmployeeStatsHandler', () => {
  it('returns stats', async () => {
    const prisma = {
      employee: {
        count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(8),
      },
      rating: {
        aggregate: jest.fn().mockResolvedValue({ _avg: { score: 4.5 } }),
      },
    };
    const handler = new EmployeeStatsHandler(prisma as any);
    const result = await handler.execute();
    expect(result.total).toBe(10);
    expect(result.active).toBe(8);
    expect(result.inactive).toBe(2);
    expect(result.avgRating).toBe(4.5);
    expect(prisma.rating.aggregate).toHaveBeenCalledWith({
      where: {},
      _avg: { score: true },
    });
  });

  it('handles null avg rating', async () => {
    const prisma = {
      employee: {
        count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(3),
      },
      rating: {
        aggregate: jest.fn().mockResolvedValue({ _avg: { score: null } }),
      },
    };
    const handler = new EmployeeStatsHandler(prisma as any);
    const result = await handler.execute();
    expect(result.avgRating).toBeNull();
  });
});
