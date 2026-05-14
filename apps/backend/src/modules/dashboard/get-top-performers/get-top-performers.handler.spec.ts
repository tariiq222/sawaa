import { Test } from '@nestjs/testing';
import { GetTopPerformersHandler } from './get-top-performers.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetTopPerformersHandler', () => {
  let handler: GetTopPerformersHandler;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        GetTopPerformersHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = mod.get(GetTopPerformersHandler);
  });

  it('returns top 5 employees ranked by month revenue', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { employeeId: 'e1', displayName: 'Dr A', avatarUrl: null, bookingsCount: 12n, revenue: 4500 },
      { employeeId: 'e2', displayName: 'Dr B', avatarUrl: null, bookingsCount: 9n, revenue: 3200 },
    ]);
    const result = await handler.execute({ period: 'month' });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      employeeId: 'e1',
      displayName: 'Dr A',
      avatarUrl: null,
      bookingsCount: 12,
      revenue: 4500,
    });
  });

  it('returns empty array when no data', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await handler.execute({ period: 'month' });
    expect(result).toEqual([]);
  });
});
