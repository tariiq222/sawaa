import { Test } from '@nestjs/testing';
import { ListGroupSessionsHandler } from './list-group-sessions.handler';
import { PrismaService } from '../../../infrastructure/database';
import { GroupSessionStatus, DeliveryType } from '@prisma/client';

const mockSession = {
  id: 'session-1',
  title: 'Test',
  scheduledAt: new Date('2026-07-01T10:00:00Z'),
  durationMins: 60,
  maxCapacity: 10,
  enrolledCount: 3,
  price: { toNumber: () => 10000, valueOf: () => 10000 } as unknown,
  status: GroupSessionStatus.OPEN,
  deliveryType: DeliveryType.IN_PERSON,
  isPublic: false,
  employeeId: 'emp-1',
  serviceId: 'svc-1',
};

const mockPrisma = {
  groupSession: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('ListGroupSessionsHandler', () => {
  let handler: ListGroupSessionsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListGroupSessionsHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(ListGroupSessionsHandler);
    jest.clearAllMocks();
  });

  it('returns a paginated list', async () => {
    mockPrisma.groupSession.findMany.mockResolvedValue([mockSession]);
    mockPrisma.groupSession.count.mockResolvedValue(1);

    const result = await handler.execute({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].spotsLeft).toBe(7);
    expect(result.meta.total).toBe(1);
  });

  it('applies upcoming filter (scheduledAt gte)', async () => {
    mockPrisma.groupSession.findMany.mockResolvedValue([]);
    mockPrisma.groupSession.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 10, upcoming: true });
    const findManyCall = mockPrisma.groupSession.findMany.mock.calls[0][0];
    expect(findManyCall.where.scheduledAt).toHaveProperty('gte');
  });

  it('applies status filter', async () => {
    mockPrisma.groupSession.findMany.mockResolvedValue([]);
    mockPrisma.groupSession.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 10, status: GroupSessionStatus.FULL });
    const findManyCall = mockPrisma.groupSession.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe(GroupSessionStatus.FULL);
  });
});
