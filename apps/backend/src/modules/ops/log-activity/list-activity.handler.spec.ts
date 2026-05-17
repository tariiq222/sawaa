import { Test, TestingModule } from '@nestjs/testing';
import { ListActivityHandler } from './list-activity.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListActivityHandler', () => {
  let handler: ListActivityHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      activityLog: { findMany: jest.fn(), count: jest.fn() },
      user: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListActivityHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<ListActivityHandler>(ListActivityHandler);
  });

  it('should list activity with default pagination', async () => {
    prisma.activityLog.findMany.mockResolvedValue([]);
    prisma.activityLog.count.mockResolvedValue(0);

    const result = await handler.execute({});
    expect(result.meta.page).toBe(1);
    expect(result.meta.perPage).toBe(50);
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }));
  });

  it('should apply all filters', async () => {
    prisma.activityLog.findMany.mockResolvedValue([]);
    prisma.activityLog.count.mockResolvedValue(0);

    await handler.execute({
      userId: 'u1',
      entity: 'Booking',
      entityId: 'book-1',
      action: 'CREATE',
      from: '2026-01-01',
      to: '2026-01-31',
      page: 2,
      limit: 10,
    });

    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'u1',
        entity: 'Booking',
        entityId: 'book-1',
        action: 'CREATE',
        occurredAt: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
      }),
      skip: 10,
      take: 10,
    }));
  });

  it('should cap limit at 100', async () => {
    prisma.activityLog.findMany.mockResolvedValue([]);
    prisma.activityLog.count.mockResolvedValue(0);

    await handler.execute({ limit: 200 });
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('should resolve user info for activity items', async () => {
    prisma.activityLog.findMany.mockResolvedValue([
      { id: 'a1', userId: 'u1', action: 'CREATE', entity: 'Booking', entityId: 'b1', description: 'Created', ipAddress: null, userAgent: null, occurredAt: new Date(), userEmail: null },
      { id: 'a2', userId: null, action: 'DELETE', entity: 'Client', entityId: 'c1', description: 'Deleted', ipAddress: null, userAgent: null, occurredAt: new Date(), userEmail: null },
    ]);
    prisma.activityLog.count.mockResolvedValue(2);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', firstName: 'Admin', lastName: 'User', email: 'admin@test.com' }]);

    const result = await handler.execute({});
    expect(result.items[0].user).toEqual(expect.objectContaining({ id: 'u1', firstName: 'Admin' }));
    expect(result.items[1].user).toBeNull();
  });
});
