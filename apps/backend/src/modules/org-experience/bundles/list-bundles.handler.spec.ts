import { Test, TestingModule } from '@nestjs/testing';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { BundlePriceService } from './bundle-price.service';
import { ListBundlesHandler } from './list-bundles.handler';

const mockBundle = {
  id: 'bundle-1',
  nameAr: 'باقة',
  discountType: DiscountType.FIXED,
  discountValue: 20,
  archivedAt: null,
  sortOrder: 0,
  createdAt: new Date(),
  items: [
    { service: { id: 'svc-1', price: 100, currency: 'SAR', isActive: true }, sortOrder: 0 },
    { service: { id: 'svc-2', price: 200, currency: 'SAR', isActive: true }, sortOrder: 1 },
  ],
};

describe('ListBundlesHandler', () => {
  let handler: ListBundlesHandler;
  let prisma: { serviceBundle: { findMany: jest.Mock; count: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      serviceBundle: {
        findMany: jest.fn().mockResolvedValue([mockBundle]),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListBundlesHandler,
        BundlePriceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<ListBundlesHandler>(ListBundlesHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('returns paginated list with computed prices', async () => {
    const result = await handler.execute({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.items[0].subtotal).toBe(300);
    expect(result.items[0].discountAmount).toBe(20);
    expect(result.items[0].finalPrice).toBe(280);
  });

  it('returns empty list when no bundles found', async () => {
    prisma.serviceBundle.findMany.mockResolvedValue([]);
    prisma.serviceBundle.count.mockResolvedValue(0);

    const result = await handler.execute({});

    expect(result.items).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });

  it('applies search filter', async () => {
    await handler.execute({ search: 'عناية' });

    expect(prisma.serviceBundle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ nameAr: expect.objectContaining({ contains: 'عناية' }) }),
          ]),
        }),
      }),
    );
  });

  it('excludes hidden bundles by default', async () => {
    await handler.execute({});

    expect(prisma.serviceBundle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: false }),
      }),
    );
  });
});
