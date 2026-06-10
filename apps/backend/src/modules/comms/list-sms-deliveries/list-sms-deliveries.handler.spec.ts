import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListSmsDeliveriesHandler } from './list-sms-deliveries.handler';

describe('ListSmsDeliveriesHandler', () => {
  let handler: ListSmsDeliveriesHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListSmsDeliveriesHandler,
    { provide: PrismaService, useValue: {
    smsDelivery: { findMany: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<ListSmsDeliveriesHandler>(ListSmsDeliveriesHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('queries the 50 most recent deliveries and wraps them in { items }', async () => {
    const rows = [{ id: 'sms-1', status: 'DELIVERED' }];
    (prisma.smsDelivery.findMany as jest.Mock).mockResolvedValue(rows);

    const result = await handler.execute();

    expect(prisma.smsDelivery.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        provider: true,
        toPhone: true,
        status: true,
        providerMessageId: true,
        errorMessage: true,
        sentAt: true,
        deliveredAt: true,
        createdAt: true,
      },
    });
    expect(result).toEqual({ items: rows });
  });
});
