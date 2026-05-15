import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DenyRefundHandler } from './deny-refund.handler';

describe('DenyRefundHandler', () => {
  let handler: DenyRefundHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DenyRefundHandler,
        { provide: PrismaService, useValue: {
    refundRequest: { findFirst: jest.fn(), update: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<DenyRefundHandler>(DenyRefundHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.refundRequest.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({refundRequestId:"00000000-0000-0000-0000-000000000001",deniedBy:"test",reason:"test"});
    
    (prisma.refundRequest.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({refundRequestId:"00000000-0000-0000-0000-000000000001",deniedBy:"test",reason:"test"})).rejects.toThrow();
  });
});
