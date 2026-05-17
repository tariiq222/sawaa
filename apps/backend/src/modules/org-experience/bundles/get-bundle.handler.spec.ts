import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { BundlePriceService } from './bundle-price.service';
import { GetBundleHandler } from './get-bundle.handler';

const mockBundle = {
  id: 'bundle-1',
  nameAr: 'باقة',
  discountType: DiscountType.PERCENTAGE,
  discountValue: 10,
  archivedAt: null,
  items: [
    { service: { id: 'svc-1', price: 100, currency: 'SAR', isActive: true }, sortOrder: 0 },
    { service: { id: 'svc-2', price: 200, currency: 'SAR', isActive: true }, sortOrder: 1 },
  ],
};

describe('GetBundleHandler', () => {
  let handler: GetBundleHandler;
  let prisma: { serviceBundle: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      serviceBundle: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetBundleHandler,
        BundlePriceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetBundleHandler>(GetBundleHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('throws 404 when bundle not found', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ bundleId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('returns bundle with computed price fields', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(mockBundle);

    const result = await handler.execute({ bundleId: 'bundle-1' });

    expect(result.id).toBe('bundle-1');
    expect(result.subtotal).toBe(300);
    expect(result.discountAmount).toBe(30);
    expect(result.finalPrice).toBe(270);
  });
});
