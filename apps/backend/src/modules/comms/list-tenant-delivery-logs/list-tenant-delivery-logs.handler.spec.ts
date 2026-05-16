import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListTenantDeliveryLogsHandler } from './list-tenant-delivery-logs.handler';

describe('ListTenantDeliveryLogsHandler', () => {
  let handler: ListTenantDeliveryLogsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListTenantDeliveryLogsHandler,
    { provide: PrismaService, useValue: {
    notificationDeliveryLog: { findMany: jest.fn(), count: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<ListTenantDeliveryLogsHandler>(ListTenantDeliveryLogsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    await handler.execute({ page: 1, perPage: 20 });
    expect(prisma.notificationDeliveryLog.findMany).toHaveBeenCalled();
  });
});
