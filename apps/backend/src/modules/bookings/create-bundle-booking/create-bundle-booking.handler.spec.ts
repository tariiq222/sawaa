import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateBundleBookingHandler } from './create-bundle-booking.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BundlePriceService } from '../../org-experience/bundles/bundle-price.service';

const futureDate = new Date(Date.now() + 86400_000);

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const mockService1 = {
  id: 'svc-1',
  nameAr: 'إرشاد',
  durationMins: 60,
  bufferMinutes: 10,
  price: new Prisma.Decimal('200'),
  currency: 'SAR',
  isActive: true,
  archivedAt: null,
};

const mockService2 = {
  id: 'svc-2',
  nameAr: 'متابعة',
  durationMins: 30,
  bufferMinutes: 5,
  price: new Prisma.Decimal('100'),
  currency: 'SAR',
  isActive: true,
  archivedAt: null,
};

const mockBundle = {
  id: 'bundle-1',
  isActive: true,
  archivedAt: null,
  discountType: 'PERCENTAGE' as const,
  discountValue: new Prisma.Decimal('10'),
  items: [
    { sortOrder: 0, service: mockService1 },
    { sortOrder: 1, service: mockService2 },
  ],
};

const baseDto = {
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  bundleId: 'bundle-1',
  scheduledAt: futureDate,
};

// ──────────────────────────────────────────────────────────────────────────────
// Mock factories
// ──────────────────────────────────────────────────────────────────────────────

const buildTx = () => ({
  $executeRaw: jest.fn().mockResolvedValue(undefined),
  booking: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockResolvedValueOnce({
        id: 'book-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        serviceId: 'svc-1',
        scheduledAt: futureDate,
        bundleGroupId: 'grp-1',
        currency: 'SAR',
        bookingNumber: 1,
      })
      .mockResolvedValueOnce({
        id: 'book-2',
        clientId: 'client-1',
        employeeId: 'emp-1',
        serviceId: 'svc-2',
        scheduledAt: new Date(futureDate.getTime() + 70 * 60_000),
        bundleGroupId: 'grp-1',
        currency: 'SAR',
        bookingNumber: 2,
      }),
  },
  bundlePurchase: {
    create: jest.fn().mockResolvedValue({ id: 'bp-1', bundleId: 'bundle-1', clientId: 'client-1' }),
    update: jest.fn().mockResolvedValue({ id: 'bp-1' }),
  },
  bundleUsage: {
    create: jest.fn().mockResolvedValue({ id: 'bu-1' }),
  },
  invoice: { create: jest.fn().mockResolvedValue({ id: 'inv-1' }) },
  organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: '0.15' }) },
  outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
});

const buildPrisma = () => ({
  serviceBundle: { findFirst: jest.fn().mockResolvedValue(mockBundle) },
  branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
  client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
  employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
  employeeService: {
    findMany: jest.fn().mockResolvedValue([
      { serviceId: 'svc-1' },
      { serviceId: 'svc-2' },
    ]),
  },
});

const buildBundlePriceService = () => ({
  computeBundlePrice: jest.fn().mockReturnValue({
    subtotal: 300,
    discountAmount: 30,
    finalPrice: 270,
  }),
});

// ──────────────────────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────────────────────

describe('CreateBundleBookingHandler', () => {
  let handler: CreateBundleBookingHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let rlsTransaction: { withTransaction: jest.Mock };
  let bundlePriceService: ReturnType<typeof buildBundlePriceService>;
  let tx: ReturnType<typeof buildTx>;

  beforeEach(async () => {
    prisma = buildPrisma();
    bundlePriceService = buildBundlePriceService();
    tx = buildTx();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateBundleBookingHandler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: (rlsTransaction = {
            withTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
          }),
        },
        { provide: BundlePriceService, useValue: bundlePriceService },
      ],
    }).compile();

    handler = module.get<CreateBundleBookingHandler>(CreateBundleBookingHandler);
  });

  afterEach(() => jest.clearAllMocks());

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Validation guards
  // ────────────────────────────────────────────────────────────────────────────

  it('throws BadRequestException when scheduledAt is in the past', async () => {
    await expect(
      handler.execute({ ...baseDto, scheduledAt: new Date(Date.now() - 1000) }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when bundle is not found', async () => {
    prisma.serviceBundle.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when bundle is not active', async () => {
    prisma.serviceBundle.findFirst = jest
      .fn()
      .mockResolvedValue({ ...mockBundle, isActive: false });
    await expect(handler.execute(baseDto)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a service in the bundle is inactive', async () => {
    prisma.serviceBundle.findFirst = jest.fn().mockResolvedValue({
      ...mockBundle,
      items: [
        { sortOrder: 0, service: { ...mockService1, isActive: false } },
        { sortOrder: 1, service: mockService2 },
      ],
    });
    await expect(handler.execute(baseDto)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a service in the bundle is archived', async () => {
    prisma.serviceBundle.findFirst = jest.fn().mockResolvedValue({
      ...mockBundle,
      items: [
        { sortOrder: 0, service: { ...mockService1, archivedAt: new Date() } },
        { sortOrder: 1, service: mockService2 },
      ],
    });
    await expect(handler.execute(baseDto)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when branch is not found', async () => {
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Branch not found');
  });

  it('throws NotFoundException when client is not found', async () => {
    prisma.client.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Client not found');
  });

  it('throws NotFoundException when employee is not found', async () => {
    prisma.employee.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Employee not found');
  });

  it('throws BadRequestException when employee does not provide all bundle services', async () => {
    // Only one of two services is provided
    prisma.employeeService.findMany = jest.fn().mockResolvedValue([{ serviceId: 'svc-1' }]);
    await expect(handler.execute(baseDto)).rejects.toThrow(
      'Employee does not provide all bundle services',
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Consecutive time slot calculation
  // ────────────────────────────────────────────────────────────────────────────

  it('schedules service-2 slot starting after service-1 slot end + buffer', async () => {
    await handler.execute(baseDto);

    const calls = (tx.booking.create as jest.Mock).mock.calls;
    const slot1Start: Date = calls[0][0].data.scheduledAt;
    const slot1End: Date = calls[0][0].data.endsAt;
    const slot2Start: Date = calls[1][0].data.scheduledAt;

    // slotEnd for svc-1 = slotStart + 60 mins
    expect(slot1End.getTime()).toBe(slot1Start.getTime() + 60 * 60_000);
    // slotStart for svc-2 = slotEnd + 10 min buffer
    expect(slot2Start.getTime()).toBe(slot1End.getTime() + 10 * 60_000);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Discount distribution
  // ────────────────────────────────────────────────────────────────────────────

  it('distributes discounted prices so they sum to finalPrice exactly', async () => {
    // bundlePriceService returns finalPrice=270, subtotal=300
    // servicePrices=[200,100]: share0=roundHalalas(200*270/300)=180, share1=270-180=90
    await handler.execute(baseDto);

    const calls = (tx.booking.create as jest.Mock).mock.calls;
    const share0: number = calls[0][0].data.discountedPrice;
    const share1: number = calls[1][0].data.discountedPrice;

    expect(Math.round((share0 + share1) * 100)).toBe(Math.round(270 * 100));
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Transaction: conflict detection
  // ────────────────────────────────────────────────────────────────────────────

  it('throws ConflictException when employee has an overlapping booking', async () => {
    tx.booking.findFirst = jest.fn().mockResolvedValue({ id: 'existing-1' });
    await expect(handler.execute(baseDto)).rejects.toThrow(ConflictException);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. Successful creation
  // ────────────────────────────────────────────────────────────────────────────

  it('creates N bookings with the same bundleGroupId', async () => {
    const result = await handler.execute(baseDto);

    expect(tx.booking.create).toHaveBeenCalledTimes(2);
    const calls = (tx.booking.create as jest.Mock).mock.calls;
    const groupIds = calls.map((c: any[]) => c[0].data.bundleGroupId);
    expect(groupIds[0]).toBe(groupIds[1]);
    expect(result.bundleGroupId).toBeTruthy();
  });

  it('creates exactly one invoice linked to the bundle purchase', async () => {
    const result = await handler.execute(baseDto);

    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
    const invoiceCall = (tx.invoice.create as jest.Mock).mock.calls[0][0];
    expect(invoiceCall.data.bookingId).toBeNull();
    expect(invoiceCall.data.bundlePurchaseId).toBeTruthy();
    expect(result.invoiceId).toBe('inv-1');
  });

  it('creates bundle invoice using computeVat (subtotal=20000, finalPrice=18000)', async () => {
    bundlePriceService.computeBundlePrice = jest.fn().mockReturnValue({
      subtotal: 20000,
      discountAmount: 2000,
      finalPrice: 18000,
    });

    await handler.execute(baseDto);

    const invoiceData = (tx.invoice.create as jest.Mock).mock.calls[0][0].data;
    expect(invoiceData.subtotal.toString()).toBe('20000');
    expect(invoiceData.discountAmt.toString()).toBe('2000');
    // vatBase = 18000, vatAmt = round_half_up(18000 * 0.15) = 2700, total = 20700
    expect(invoiceData.vatRate.toString()).toBe('0.15');
    expect(invoiceData.vatAmt.toString()).toBe('2700');
    expect(invoiceData.total.toString()).toBe('20700');
  });

  it('skips invoice when payAtClinic=true', async () => {
    const result = await handler.execute({ ...baseDto, payAtClinic: true });

    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(result.invoiceId).toBeNull();
  });

  it('writes one outboxEvent per booking', async () => {
    await handler.execute(baseDto);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(2);
  });

  it('returns bundleGroupId, bookings array and invoiceId', async () => {
    const result = await handler.execute(baseDto);
    expect(result).toHaveProperty('bundleGroupId');
    expect(result).toHaveProperty('bookings');
    expect(result).toHaveProperty('invoiceId');
    expect(Array.isArray(result.bookings)).toBe(true);
    expect(result.bookings).toHaveLength(2);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 6. DB conflict error mapping
  // ────────────────────────────────────────────────────────────────────────────

  it('maps Postgres 23P01 exclusion violation to ConflictException', async () => {
    const exclusionError = new Prisma.PrismaClientKnownRequestError(
      'exclusion constraint violation',
      { code: 'P2010', clientVersion: '5.0.0', meta: { code: '23P01' } },
    );
    rlsTransaction.withTransaction = jest.fn().mockRejectedValueOnce(exclusionError);

    await expect(handler.execute(baseDto)).rejects.toThrow(ConflictException);
  });

  // ─── BundlePurchase + BundleUsage (TDD — refactor-booking-delivery-type) ───

  it('creates a BundlePurchase record for the bundle booking', async () => {
    await handler.execute(baseDto);

    expect(tx.bundlePurchase.create).toHaveBeenCalledTimes(1);
    expect(tx.bundlePurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bundleId: 'bundle-1',
          clientId: 'client-1',
          branchId: 'branch-1',
          amountPaid: expect.any(Number),
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('creates BundleUsage per booking with correct service and deliveryType', async () => {
    await handler.execute(baseDto);

    expect(tx.bundleUsage.create).toHaveBeenCalledTimes(2);
    const calls = (tx.bundleUsage.create as jest.Mock).mock.calls;
    expect(calls[0][0].data).toMatchObject({
      purchaseId: 'bp-1',
      bookingId: 'book-1',
      serviceId: 'svc-1',
      deliveryType: 'IN_PERSON',
      quantityUsed: 1,
    });
    expect(calls[1][0].data).toMatchObject({
      purchaseId: 'bp-1',
      bookingId: 'book-2',
      serviceId: 'svc-2',
      deliveryType: 'IN_PERSON',
      quantityUsed: 1,
    });
  });

  it('links invoice to BundlePurchase instead of booking', async () => {
    await handler.execute(baseDto);

    expect(tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bundlePurchaseId: 'bp-1',
          bookingId: null,
        }),
      }),
    );
  });

  it('tracks remaining quantity on BundlePurchase', async () => {
    tx.bundlePurchase.create = jest.fn().mockResolvedValue({
      id: 'bp-1',
      bundleId: 'bundle-1',
      quantityTotal: 5,
      quantityUsed: 2,
    });

    await handler.execute(baseDto);

    // After creating 2 bookings, should have 3 remaining
    expect(tx.bundlePurchase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bp-1' },
        data: { quantityUsed: 2 },
      }),
    );
  });

  it('prevents over-usage when bundle has no remaining quantity', async () => {
    tx.bundlePurchase.create = jest.fn().mockResolvedValue({
      id: 'bp-1',
      bundleId: 'bundle-1',
      quantityTotal: 1,
      quantityUsed: 1,
    });

    await expect(handler.execute(baseDto)).rejects.toThrow(
      'Bundle has no remaining sessions',
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 7. payAtClinic gate + per-slot availability validation (Sprint-3 hardening)
  // ────────────────────────────────────────────────────────────────────────────

  describe('payAtClinic gate', () => {
    const buildSettings = (payAtClinicEnabled: boolean) => ({
      execute: jest.fn().mockResolvedValue({ payAtClinicEnabled }),
    });

    it('rejects payAtClinic when the branch disables it', async () => {
      const h = new CreateBundleBookingHandler(
        prisma as never,
        rlsTransaction as never,
        bundlePriceService as never,
        buildSettings(false) as never,
      );
      await expect(h.execute({ ...baseDto, payAtClinic: true })).rejects.toThrow(
        'Pay at clinic is not enabled for this branch',
      );
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('allows payAtClinic when the branch enables it', async () => {
      const h = new CreateBundleBookingHandler(
        prisma as never,
        rlsTransaction as never,
        bundlePriceService as never,
        buildSettings(true) as never,
      );
      const result = await h.execute({ ...baseDto, payAtClinic: true });
      expect(result.bundleGroupId).toBeTruthy();
    });
  });

  describe('per-slot availability validation', () => {
    const buildAvailability = (allAvailable: boolean) => ({
      execute: jest.fn(async (input: { date: Date }) =>
        allAvailable ? [{ startTime: new Date(input.date) }] : [],
      ),
    });

    it('rejects when a bundle service slot is not available', async () => {
      const h = new CreateBundleBookingHandler(
        prisma as never,
        rlsTransaction as never,
        bundlePriceService as never,
        undefined,
        buildAvailability(false) as never,
      );
      await expect(h.execute(baseDto)).rejects.toThrow(BadRequestException);
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('creates the bundle when all slots are available', async () => {
      const availability = buildAvailability(true);
      const h = new CreateBundleBookingHandler(
        prisma as never,
        rlsTransaction as never,
        bundlePriceService as never,
        undefined,
        availability as never,
      );
      const result = await h.execute(baseDto);
      expect(result.bookings).toHaveLength(2);
      // One availability check per bundle service (2).
      expect(availability.execute).toHaveBeenCalledTimes(2);
    });
  });
});
