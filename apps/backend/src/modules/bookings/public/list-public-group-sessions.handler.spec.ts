import { Test } from '@nestjs/testing';
import { ListPublicGroupSessionsHandler } from './list-public-group-sessions.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListPublicGroupSessionsHandler', () => {
  let handler: ListPublicGroupSessionsHandler;
  let prisma: { groupSession: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { groupSession: { findMany: jest.fn() } };

    const module = await Test.createTestingModule({
      providers: [
        ListPublicGroupSessionsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(ListPublicGroupSessionsHandler);
  });

  it('returns sessions without branch filter', async () => {
    prisma.groupSession.findMany.mockResolvedValue([
      { id: '1', price: 100, scheduledAt: new Date('2026-01-01') },
    ]);
    const result = await handler.execute();
    expect(prisma.groupSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPublic: true, status: 'OPEN' }),
      }),
    );
    expect(result[0].price).toBe(100);
  });

  it('filters by departmentId when provided', async () => {
    prisma.groupSession.findMany.mockResolvedValue([]);
    await handler.execute('dept-1');
    expect(prisma.groupSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ program: { departmentId: 'dept-1' } }),
      }),
    );
  });

  it('converts price to Number', async () => {
    prisma.groupSession.findMany.mockResolvedValue([
      { id: '1', price: '50.5' },
    ]);
    const result = await handler.execute();
    expect(result[0].price).toBe(50.5);
  });

  it('computes spotsLeft for a session with free spots', async () => {
    prisma.groupSession.findMany.mockResolvedValue([
      {
        id: '1',
        price: 100,
        maxCapacity: 10,
        enrolledCount: 4,
      },
    ]);
    const result = await handler.execute();
    expect(result[0].spotsLeft).toBe(6);
    expect(result[0].isFull).toBe(false);
  });

  it('marks a full session as full', async () => {
    prisma.groupSession.findMany.mockResolvedValue([
      {
        id: '1',
        price: 100,
        maxCapacity: 10,
        enrolledCount: 10,
      },
    ]);
    const result = await handler.execute();
    expect(result[0].spotsLeft).toBe(0);
    expect(result[0].isFull).toBe(true);
  });

  it('marks a full session as full when enrollment equals capacity', async () => {
    prisma.groupSession.findMany.mockResolvedValue([
      {
        id: '1',
        price: 100,
        maxCapacity: 10,
        enrolledCount: 10,
      },
    ]);
    const result = await handler.execute();
    expect(result[0].spotsLeft).toBe(0);
    expect(result[0].isFull).toBe(true);
  });
});
