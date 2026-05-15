import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetCouponHandler } from './get-coupon.handler';

describe('GetCouponHandler', () => {
  let handler: GetCouponHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCouponHandler,
        { provide: PrismaService, useValue: {
    coupon: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetCouponHandler>(GetCouponHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.coupon.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({couponId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.coupon.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({couponId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
