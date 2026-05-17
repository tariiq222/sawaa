import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BundlePriceService } from './bundle-price.service';
import { CreateBundleHandler } from './create-bundle.handler';

const mockService1 = {
  id: 'svc-1',
  nameAr: 'خدمة 1',
  price: 100,
  currency: 'SAR',
  isActive: true,
  archivedAt: null,
};
const mockService2 = {
  id: 'svc-2',
  nameAr: 'خدمة 2',
  price: 200,
  currency: 'SAR',
  isActive: true,
  archivedAt: null,
};

const mockBundle = {
  id: 'bundle-1',
  nameAr: 'باقة',
  discountType: DiscountType.PERCENTAGE,
  discountValue: 10,
  items: [
    { service: mockService1, sortOrder: 0 },
    { service: mockService2, sortOrder: 1 },
  ],
};

function makePrismaMock() {
  const txMock = {
    serviceBundle: {
      create: jest.fn().mockResolvedValue({ id: 'bundle-1' }),
      findFirstOrThrow: jest.fn().mockResolvedValue(mockBundle),
    },
    serviceBundleItem: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    service: {
      findMany: jest.fn(),
    },
  };

  return {
    serviceBundle: {
      findFirst: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((fn: (tx: typeof txMock) => Promise<unknown>) =>
      fn(txMock),
    ),
    _txMock: txMock,
  };
}

describe('CreateBundleHandler', () => {
  let handler: CreateBundleHandler;
  let prisma: ReturnType<typeof makePrismaMock>;
  let bundlePrice: BundlePriceService;

  const validDto = {
    nameAr: 'باقة',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    serviceIds: ['svc-1', 'svc-2'],
  };

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateBundleHandler,
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

    handler = module.get<CreateBundleHandler>(CreateBundleHandler);
    bundlePrice = module.get<BundlePriceService>(BundlePriceService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('throws 409 when nameAr already exists', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(handler.execute(validDto as any)).rejects.toThrow(ConflictException);
  });

  it('throws 400 when a service is not found', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    prisma.service.findMany.mockResolvedValue([mockService1]); // only 1, needs 2

    await expect(handler.execute(validDto as any)).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when a service is inactive', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    prisma.service.findMany.mockResolvedValue([
      mockService1,
      { ...mockService2, isActive: false },
    ]);

    await expect(handler.execute(validDto as any)).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when services have mixed currencies', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    prisma.service.findMany.mockResolvedValue([
      mockService1,
      { ...mockService2, currency: 'USD' },
    ]);

    await expect(handler.execute(validDto as any)).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when FIXED discount exceeds subtotal', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    prisma.service.findMany.mockResolvedValue([
      { ...mockService1, price: 50 },
      { ...mockService2, price: 30 },
    ]);

    await expect(
      handler.execute({ ...validDto, discountType: DiscountType.FIXED, discountValue: 200 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when PERCENTAGE discount exceeds 100', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    prisma.service.findMany.mockResolvedValue([mockService1, mockService2]);

    await expect(
      handler.execute({ ...validDto, discountType: DiscountType.PERCENTAGE, discountValue: 150 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates and returns bundle with computed price on success', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    prisma.service.findMany.mockResolvedValue([mockService1, mockService2]);

    const result = await handler.execute(validDto as any);

    expect(result).toMatchObject({
      id: 'bundle-1',
      subtotal: 300,
      discountAmount: 30,
      finalPrice: 270,
    });
  });
});
