import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListTenantDeliveryLogsHandler } from './list-tenant-delivery-logs.handler';

describe('ListTenantDeliveryLogsHandler', () => {
  let handler: ListTenantDeliveryLogsHandler;
  let prisma: { notificationDeliveryLog: { findMany: jest.Mock; count: jest.Mock } };

  beforeEach(async () => {
    prisma = { notificationDeliveryLog: { findMany: jest.fn(), count: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListTenantDeliveryLogsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<ListTenantDeliveryLogsHandler>(ListTenantDeliveryLogsHandler);
  });

  it('passes status and channel filters through to the where clause', async () => {
    prisma.notificationDeliveryLog.findMany.mockResolvedValue([]);
    prisma.notificationDeliveryLog.count.mockResolvedValue(0);

    await handler.execute({
      page: 1,
      limit: 20,
      status: 'FAILED' as never,
      channel: 'EMAIL' as never,
    });

    expect(prisma.notificationDeliveryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'FAILED', channel: 'EMAIL' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(prisma.notificationDeliveryLog.count).toHaveBeenCalledWith({
      where: { status: 'FAILED', channel: 'EMAIL' },
    });
  });

  it('uses an empty where clause when no filters are provided', async () => {
    prisma.notificationDeliveryLog.findMany.mockResolvedValue([]);
    prisma.notificationDeliveryLog.count.mockResolvedValue(0);

    await handler.execute({ page: 2, limit: 50 });

    expect(prisma.notificationDeliveryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 50, take: 50 }),
    );
  });

  it('returns the items + meta block (paginated shape)', async () => {
    const rows = [{ id: 'log-1' }];
    prisma.notificationDeliveryLog.findMany.mockResolvedValue(rows);
    prisma.notificationDeliveryLog.count.mockResolvedValue(1);

    const result = await handler.execute({ page: 1, limit: 20 });

    expect(result.items).toBe(rows);
    expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('projects only the public-safe fields (NO internal payload / metadata)', async () => {
    prisma.notificationDeliveryLog.findMany.mockResolvedValue([]);
    prisma.notificationDeliveryLog.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 10 });

    const select = (prisma.notificationDeliveryLog.findMany as jest.Mock).mock.calls[0][0].select;
    expect(select).toEqual(
      expect.objectContaining({
        id: true,
        recipientId: true,
        type: true,
        priority: true,
        channel: true,
        status: true,
        senderActor: true,
        toAddress: true,
        providerName: true,
        attempts: true,
        lastAttemptAt: true,
        sentAt: true,
        errorMessage: true,
        createdAt: true,
      }),
    );
    // Sensitive internal fields must not be projected.
    expect(select.payload).toBeUndefined();
    expect(select.metadata).toBeUndefined();
  });
});