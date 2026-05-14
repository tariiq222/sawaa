import { ListActivityHandler } from './list-activity.handler';

const ORG_A = 'org-a-00000000-0000-0000-0000-000000000001';
const ORG_B = 'org-b-00000000-0000-0000-0000-000000000002';

const mockLogsA = [
  {
    id: 'log-1',
    organizationId: ORG_A,
    userId: null,
    userEmail: null,
    action: 'CREATE',
    entity: 'Booking',
    entityId: 'booking-a-1',
    description: 'Org A created a booking',
    metadata: null,
    ipAddress: null,
    userAgent: null,
    occurredAt: new Date(),
  },
];

const mockLogsB = [
  {
    id: 'log-2',
    organizationId: ORG_B,
    userId: null,
    userEmail: null,
    action: 'UPDATE',
    entity: 'Client',
    entityId: 'client-b-1',
    description: 'Org B updated a client',
    metadata: null,
    ipAddress: null,
    userAgent: null,
    occurredAt: new Date(),
  },
];

const buildPrisma = (logs: typeof mockLogsA) => ({
  activityLog: {
    findMany: jest.fn().mockResolvedValue(logs),
    count: jest.fn().mockResolvedValue(logs.length),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([]),
  },
});

describe('ListActivityHandler', () => {
  it('returns paginated activity logs scoped to organizationId', async () => {
    const prisma = buildPrisma(mockLogsA);
    const handler = new ListActivityHandler(prisma as never);

    const result = await handler.execute({ organizationId: ORG_A, page: 1, limit: 10 });

    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_A }),
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('scopes query to the caller org — cross-org isolation at handler level', async () => {
    // Org A sees only org-A logs
    const prismaA = buildPrisma(mockLogsA);
    const handlerA = new ListActivityHandler(prismaA as never);
    await handlerA.execute({ organizationId: ORG_A, page: 1, limit: 50 });
    expect(prismaA.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_A }),
      }),
    );

    // Org B sees only org-B logs
    const prismaB = buildPrisma(mockLogsB);
    const handlerB = new ListActivityHandler(prismaB as never);
    await handlerB.execute({ organizationId: ORG_B, page: 1, limit: 50 });
    expect(prismaB.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_B }),
      }),
    );
  });
});
