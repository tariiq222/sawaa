import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateCouponHandler } from './update-coupon.handler';

describe('UpdateCouponHandler', () => {
  let handler: UpdateCouponHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateCouponHandler,
        { provide: PrismaService, useValue: {
    coupon: { findFirst: jest.fn(), update: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<UpdateCouponHandler>(UpdateCouponHandler);
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
