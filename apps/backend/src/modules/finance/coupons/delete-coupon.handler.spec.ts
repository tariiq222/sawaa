import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteCouponHandler } from './delete-coupon.handler';

describe('DeleteCouponHandler', () => {
  let handler: DeleteCouponHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteCouponHandler,
        { provide: PrismaService, useValue: {
    coupon: { findFirst: jest.fn(), delete: jest.fn() },
    couponRedemption: { count: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<DeleteCouponHandler>(DeleteCouponHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.coupon.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({couponId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.coupon.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({couponId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
