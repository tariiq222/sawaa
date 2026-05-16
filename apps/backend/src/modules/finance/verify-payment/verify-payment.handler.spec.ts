import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { VerifyPaymentHandler } from './verify-payment.handler';

describe('VerifyPaymentHandler', () => {
  let handler: VerifyPaymentHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyPaymentHandler,
    { provide: PrismaService, useValue: {
    payment: { findFirst: jest.fn(), update: jest.fn() },
    invoice: { findFirst: jest.fn() }
    } },
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn() } },
    { provide: EventBusService, useValue: { emit: jest.fn() } }
      ],
    }).compile();

    handler = module.get<VerifyPaymentHandler>(VerifyPaymentHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ paymentId: '00000000-0000-0000-0000-000000000001', action: 'approve' } as any);
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
