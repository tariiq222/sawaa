import { ConflictException } from '@nestjs/common';
import { CreateCouponHandler } from './create-coupon.handler';

const buildTenant = () => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000001'),
});

const mockCoupon = {
  id: 'coupon-1',
  organizationId: '00000000-0000-0000-0000-000000000001',
  code: 'SAVE10',
  descriptionAr: 'خصم 10%',
  descriptionEn: '10% off',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  minOrderAmt: null,
  maxUses: null,
  maxUsesPerUser: null,
  serviceIds: [],
  expiresAt: null,
  isActive: true,
  usedCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () => ({
  coupon: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockCoupon),
  },
});

const cmd = {
  code: 'SAVE10',
  descriptionAr: 'خصم 10%',
  descriptionEn: '10% off',
  discountType: 'PERCENTAGE' as const,
  discountValue: 10,
};

describe('CreateCouponHandler', () => {
  it('creates a coupon with organizationId scoped to current tenant', async () => {
    const prisma = buildPrisma();
    const handler = new CreateCouponHandler(prisma as never, buildTenant() as never);

    const result = await handler.execute(cmd);

    expect(prisma.coupon.findFirst).toHaveBeenCalledWith({ where: { code: 'SAVE10' } });
    expect(prisma.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: '00000000-0000-0000-0000-000000000001',
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        }),
      }),
    );
    expect(result.id).toBe('coupon-1');
  });

  it('throws ConflictException when coupon code already exists', async () => {
    const prisma = buildPrisma();
    prisma.coupon.findFirst = jest.fn().mockResolvedValue(mockCoupon);
    const handler = new CreateCouponHandler(prisma as never, buildTenant() as never);

    await expect(handler.execute(cmd)).rejects.toThrow(ConflictException);
    expect(prisma.coupon.create).not.toHaveBeenCalled();
  });
});
