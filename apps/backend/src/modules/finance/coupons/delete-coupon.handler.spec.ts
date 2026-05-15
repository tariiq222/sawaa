import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteCouponHandler } from './delete-coupon.handler';

describe('DeleteCouponHandler', () => {
  let handler: DeleteCouponHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      coupon: { findFirst: jest.fn(), delete: jest.fn() },
      couponRedemption: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DeleteCouponHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<DeleteCouponHandler>(DeleteCouponHandler);
  });

  it('should throw NotFoundException when coupon not found', async () => {
    prisma.coupon.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ couponId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when coupon has redemptions', async () => {
    prisma.coupon.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.couponRedemption.count.mockResolvedValue(3);
    await expect(handler.execute({ couponId: 'c1' })).rejects.toThrow(BadRequestException);
  });

  it('should delete coupon when no redemptions', async () => {
    prisma.coupon.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.couponRedemption.count.mockResolvedValue(0);
    prisma.coupon.delete.mockResolvedValue({ id: 'c1' });

    await handler.execute({ couponId: 'c1' });
    expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });
});
