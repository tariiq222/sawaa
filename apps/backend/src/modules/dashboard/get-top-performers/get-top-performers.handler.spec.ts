import { OwnedImageResolver } from '../../media/owned-image.resolver';
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
        { provide: OwnedImageResolver, useValue: { resolve: jest.fn(async (_type, _id, value) => value ? "https://files.sawaa.sa/signed-image" : null) } },
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

  it('returns a usable image instead of the internal object key', async () => {
    prisma.$queryRaw.mockResolvedValue([{ employeeId: 'e1', displayName: 'Dr A', avatarUrl: 'org/photo.png', bookingsCount: 1, revenue: 100 }]);
    const result = await handler.execute({ period: 'month' });
    expect(result[0].avatarUrl).toBe('https://files.sawaa.sa/signed-image');
  });

  it('returns empty array when no data', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await handler.execute({ period: 'month' });
    expect(result).toEqual([]);
  });
});

it('uses effective receipt date with PROCESSED fallback for revenue bounds', async () => {
 const prisma = {$queryRaw: jest.fn().mockResolvedValue([]), booking: {groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0)}, client: {count: jest.fn().mockResolvedValue(0)}};
 await new GetTopPerformersHandler(prisma as never, { resolve: jest.fn() } as never).execute({period: 'month'});
 expect(prisma.$queryRaw.mock.calls[0][0].sql).toContain('COALESCE(p."effectiveReceivedAt", p."processedAt")');
});
