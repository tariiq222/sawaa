import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BundlePriceService } from './bundle-price.service';
import { UpdateBundleHandler } from './update-bundle.handler';

const existingBundle = {
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

const updatedBundle = { ...existingBundle, nameAr: 'باقة محدّثة' };

function makePrismaMock() {
  const txMock = {
    serviceBundle: {
      update: jest.fn().mockResolvedValue(updatedBundle),
      findFirstOrThrow: jest.fn().mockResolvedValue(updatedBundle),
      findFirst: jest.fn(),
    },
    serviceBundleItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    service: {
      findMany: jest.fn(),
    },
  };

  return {
    serviceBundle: { findFirst: jest.fn() },
    $transaction: jest.fn().mockImplementation((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    _txMock: txMock,
  };
}

describe('UpdateBundleHandler', () => {
  let handler: UpdateBundleHandler;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateBundleHandler,
        BundlePriceService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma._txMock)),
            withBypassTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma._txMock)),
          },
        },
      ],
    }).compile();

    handler = module.get<UpdateBundleHandler>(UpdateBundleHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('throws 404 when bundle not found', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ bundleId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('throws 409 when nameAr conflicts with another bundle', async () => {
    prisma.serviceBundle.findFirst
      .mockResolvedValueOnce(existingBundle) // fetch existing
      .mockResolvedValueOnce({ id: 'other-bundle' }); // conflict check

    await expect(
      handler.execute({ bundleId: 'bundle-1', nameAr: 'اسم مكرر' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws 400 when updated services not all found', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(existingBundle);
    prisma._txMock.service.findMany.mockResolvedValue([{ id: 'svc-1', price: 100, currency: 'SAR', isActive: true }]);

    await expect(
      handler.execute({ bundleId: 'bundle-1', serviceIds: ['svc-1', 'svc-new'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('successfully updates without changing services', async () => {
    prisma.serviceBundle.findFirst
      .mockResolvedValueOnce(existingBundle) // fetch existing
      .mockResolvedValueOnce(null); // no conflict on nameAr

    const result = await handler.execute({ bundleId: 'bundle-1', nameAr: 'باقة محدّثة' });

    expect(result).toBeDefined();
    expect(result.subtotal).toBeDefined();
    expect(result.finalPrice).toBeDefined();
  });

  it('successfully updates with new services', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(existingBundle);
    prisma._txMock.service.findMany.mockResolvedValue([
      { id: 'svc-1', price: 100, currency: 'SAR', isActive: true },
      { id: 'svc-3', price: 150, currency: 'SAR', isActive: true },
    ]);

    const result = await handler.execute({
      bundleId: 'bundle-1',
      serviceIds: ['svc-1', 'svc-3'],
    });

    expect(result).toBeDefined();
    expect(result.subtotal).toBe(250);
  });
});
