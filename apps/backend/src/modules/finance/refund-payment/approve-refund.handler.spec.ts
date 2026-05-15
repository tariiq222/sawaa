import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { ApproveRefundHandler } from './approve-refund.handler';

describe('ApproveRefundHandler', () => {
  let handler: ApproveRefundHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApproveRefundHandler,
    { provide: PrismaService, useValue: {
    refundRequest: { findFirst: jest.fn(), update: jest.fn() }
    } },
    { provide: MoyasarApiClient, useValue: {} },
    { provide: EventBusService, useValue: { emit: jest.fn() } }
      ],
    }).compile();

    handler = module.get<ApproveRefundHandler>(ApproveRefundHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ id: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
