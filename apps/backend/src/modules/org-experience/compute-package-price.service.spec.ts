import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database';
import { ComputePackagePriceService } from './compute-package-price.service';
import { DiscountType } from '@prisma/client';

/**
 * Build a per-test PrismaService stub with jest.fn()s for every method the
 * pricing service touches. The tests use `prismaMock` to script individual
 * query responses per scenario.
 */
function buildPrisma() {
  return {
    employeeService: {
      findFirst: jest.fn(),
    },
    employeeServiceOption: {
      findFirst: jest.fn(),
    },
    serviceDurationOption: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe('ComputePackagePriceService', () => {
  let handler: ComputePackagePriceService;
  let prisma: ReturnType<typeof buildPrisma>;

  const EMPLOYEE_SERVICE_ID = 'es-1';
  const SERVICE_ID = 'svc-1';
  const EMPLOYEE_ID = 'emp-1';
  const DURATION_OPTION_ID = 'dur-1';

  const validItem = {
    serviceId: SERVICE_ID,
    employeeId: EMPLOYEE_ID,
    durationOptionId: DURATION_OPTION_ID,
    paidQuantity: 5,
    freeQuantity: 0,
  };

  beforeEach(async () => {
    prisma = buildPrisma();

    const module = await Test.createTestingModule({
      providers: [
        ComputePackagePriceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(ComputePackagePriceService);
  });

  /**
   * Default mock wiring used by most tests: an employee-service link exists,
   * no override applies, the duration-option base price is 10000 halalas.
   */
  function mockDefaultResolution({ basePrice = 10_000 }: { basePrice?: number } = {}) {
    (prisma.employeeService.findFirst as jest.Mock).mockResolvedValue({ id: EMPLOYEE_SERVICE_ID });
    (prisma.employeeServiceOption.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.serviceDurationOption.findFirst as jest.Mock).mockResolvedValue({
      id: DURATION_OPTION_ID,
      serviceId: SERVICE_ID,
      price: { toString: () => String(basePrice) },
    });
  }

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  describe('price resolution', () => {
    it('uses EmployeeServiceOption.priceOverride when present (override path)', async () => {
      (prisma.employeeService.findFirst as jest.Mock).mockResolvedValue({ id: EMPLOYEE_SERVICE_ID });
      (prisma.employeeServiceOption.findFirst as jest.Mock).mockResolvedValue({
        priceOverride: { toString: () => '7500' },
        durationOptionId: DURATION_OPTION_ID,
      });

      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 2 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0,
      });

      expect(result.subtotal).toBe(15_000);
      expect(result.discountAmount).toBe(0);
      expect(result.finalPrice).toBe(15_000);
      expect(result.itemUnitPrices).toEqual([{ durationOptionId: DURATION_OPTION_ID, unitPrice: 7_500 }]);
    });

    it('falls back to ServiceDurationOption.price when no EmployeeServiceOption row exists', async () => {
      (prisma.employeeService.findFirst as jest.Mock).mockResolvedValue({ id: EMPLOYEE_SERVICE_ID });
      (prisma.employeeServiceOption.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.serviceDurationOption.findFirst as jest.Mock).mockResolvedValue({
        id: DURATION_OPTION_ID,
        serviceId: SERVICE_ID,
        price: { toString: () => '12000' },
      });

      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 3 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0,
      });

      expect(result.subtotal).toBe(36_000);
      expect(result.itemUnitPrices[0].unitPrice).toBe(12_000);
    });

    it('ignores EmployeeServiceOption.priceOverride when null (still falls back)', async () => {
      (prisma.employeeService.findFirst as jest.Mock).mockResolvedValue({ id: EMPLOYEE_SERVICE_ID });
      (prisma.employeeServiceOption.findFirst as jest.Mock).mockResolvedValue({
        priceOverride: null,
        durationOptionId: DURATION_OPTION_ID,
      });
      (prisma.serviceDurationOption.findFirst as jest.Mock).mockResolvedValue({
        id: DURATION_OPTION_ID,
        price: { toString: () => '9000' },
      });

      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 2 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0,
      });

      expect(result.itemUnitPrices[0].unitPrice).toBe(9_000);
    });

    it('throws when the EmployeeService link does not exist', async () => {
      (prisma.employeeService.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        handler.compute({
          items: [validItem],
          discountType: DiscountType.PERCENTAGE,
          discountValue: 0,
        }),
      ).rejects.toThrow(/employee service/i);
    });

    it('throws when no duration option matches', async () => {
      (prisma.employeeService.findFirst as jest.Mock).mockResolvedValue({ id: EMPLOYEE_SERVICE_ID });
      (prisma.employeeServiceOption.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.serviceDurationOption.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        handler.compute({
          items: [validItem],
          discountType: DiscountType.PERCENTAGE,
          discountValue: 0,
        }),
      ).rejects.toThrow(/DurationOption/i);
    });
  });

  describe('discount math', () => {
    it('returns zero discount for both PERCENTAGE and FIXED when discountValue = 0', async () => {
      mockDefaultResolution();
      const pct = await handler.compute({
        items: [{ ...validItem, paidQuantity: 4 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0,
      });
      const fix = await handler.compute({
        items: [{ ...validItem, paidQuantity: 4 }],
        discountType: DiscountType.FIXED,
        discountValue: 0,
      });
      expect(pct.discountAmount).toBe(0);
      expect(pct.finalPrice).toBe(pct.subtotal);
      expect(fix.discountAmount).toBe(0);
      expect(fix.finalPrice).toBe(fix.subtotal);
    });

    it('PERCENTAGE 10% of 100_000 halalas subtotal = 10_000 halalas discount', async () => {
      mockDefaultResolution({ basePrice: 20_000 });
      // 5 paid × 20_000 = 100_000; 10% → 10_000; final = 90_000.
      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 5 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
      });
      expect(result.subtotal).toBe(100_000);
      expect(result.discountAmount).toBe(10_000);
      expect(result.finalPrice).toBe(90_000);
    });

    it('PERCENTAGE rounds down (floor) — 7% of 333 halalas = 23 (not 24)', async () => {
      mockDefaultResolution({ basePrice: 333 });
      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 1 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 7,
      });
      expect(result.subtotal).toBe(333);
      expect(result.discountAmount).toBe(23);
      expect(result.finalPrice).toBe(310);
    });

    it('PERCENTAGE > 100 clamps the discount at the subtotal', async () => {
      mockDefaultResolution({ basePrice: 10_000 });
      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 2 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 250,
      });
      expect(result.subtotal).toBe(20_000);
      expect(result.discountAmount).toBe(20_000);
      expect(result.finalPrice).toBe(0);
    });

    it('FIXED discount caps at the subtotal when discountValue exceeds it', async () => {
      mockDefaultResolution({ basePrice: 5_000 });
      // 1 paid × 5_000 = 5_000; FIXED 9_999 clamps to 5_000 → final = 0.
      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 1 }],
        discountType: DiscountType.FIXED,
        discountValue: 9_999,
      });
      expect(result.subtotal).toBe(5_000);
      expect(result.discountAmount).toBe(5_000);
      expect(result.finalPrice).toBe(0);
    });

    it('FIXED discount below subtotal reduces the final price by exactly that amount', async () => {
      mockDefaultResolution({ basePrice: 10_000 });
      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 3 }],
        discountType: DiscountType.FIXED,
        discountValue: 7_500,
      });
      expect(result.subtotal).toBe(30_000);
      expect(result.discountAmount).toBe(7_500);
      expect(result.finalPrice).toBe(22_500);
    });
  });

  describe('multi-item aggregation + free items', () => {
    it('sums paidQuantity × unitPrice across all items', async () => {
      (prisma.employeeService.findFirst as jest.Mock).mockResolvedValue({ id: 'es-1' });
      (prisma.employeeServiceOption.findFirst as jest.Mock).mockResolvedValue(null);
      // Two distinct duration options with different base prices.
      (prisma.serviceDurationOption.findFirst as jest.Mock).mockImplementation((args: { where: { id: string } }) => {
        const price = args.where.id === 'dur-1' ? 10_000 : 4_000;
        return Promise.resolve({ id: args.where.id, serviceId: 'svc-1', price: { toString: () => String(price) } });
      });

      const result = await handler.compute({
        items: [
          { ...validItem, durationOptionId: 'dur-1', paidQuantity: 2 }, // 2 × 10_000 = 20_000
          { ...validItem, durationOptionId: 'dur-2', paidQuantity: 3 }, // 3 × 4_000  = 12_000
        ],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0,
      });

      expect(result.subtotal).toBe(32_000);
      expect(result.itemUnitPrices).toHaveLength(2);
    });

    it('a free-only item (paidQuantity = 0) contributes 0 to the subtotal even though a unit price resolves', async () => {
      (prisma.employeeService.findFirst as jest.Mock).mockResolvedValue({ id: 'es-1' });
      (prisma.employeeServiceOption.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.serviceDurationOption.findFirst as jest.Mock).mockImplementation((args: { where: { id: string } }) => {
        const price = args.where.id === 'dur-1' ? 10_000 : 4_000;
        return Promise.resolve({ id: args.where.id, serviceId: 'svc-1', price: { toString: () => String(price) } });
      });

      const result = await handler.compute({
        items: [
          { ...validItem, durationOptionId: 'dur-1', paidQuantity: 2 }, // 20_000
          { ...validItem, durationOptionId: 'dur-2', paidQuantity: 0, freeQuantity: 3 }, // contributes 0
        ],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0,
      });

      expect(result.subtotal).toBe(20_000);
      // itemUnitPrices still surfaces the resolved unit price so the catalog UI can show "free with purchase".
      expect(result.itemUnitPrices).toEqual(
        expect.arrayContaining([
          { durationOptionId: 'dur-1', unitPrice: 10_000 },
          { durationOptionId: 'dur-2', unitPrice: 4_000 },
        ]),
      );
    });

    it('finalPrice never goes below zero (PERCENTAGE 100% on tiny subtotal)', async () => {
      mockDefaultResolution({ basePrice: 1 });
      const result = await handler.compute({
        items: [{ ...validItem, paidQuantity: 1 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 100,
      });
      expect(result.finalPrice).toBeGreaterThanOrEqual(0);
      expect(result.finalPrice).toBe(0);
    });
  });
});