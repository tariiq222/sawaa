import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateBookingHandler } from './create-booking.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { PriceResolverService } from '../../org-experience/services/price-resolver.service';
import { GetBookingSettingsHandler, DEFAULT_BOOKING_SETTINGS } from '../get-booking-settings/get-booking-settings.handler';
import { EventBusService } from '../../../infrastructure/events';
import { ValidateCouponService } from '../coupons/validate-coupon.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import {
  STAFF_TIME_BLOCKING_BOOKING_STATUSES,
} from '../active-booking-statuses';

const futureDate = new Date(Date.now() + 86400_000);

const mockBooking = {
  id: 'book-1',
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  serviceId: 'svc-1',
  scheduledAt: futureDate,
  durationMins: 60,
  price: 200,
  currency: 'SAR',
  status: 'PENDING',
  bookingNumber: 1,
};

const mockInvoice = { id: 'invoice-1' };

const mockService = {
  id: 'svc-1',
  durationMins: 60,
  price: 200,
  currency: 'SAR',
  isActive: true,
  archivedAt: null,
  isHidden: false,
  categoryId: 'cat-1',
  category: { bookingMode: 'SERVICES' },
};

const buildPrisma = () => {
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', nameAr: 'الفرع الرئيسي' }) },
    client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
    employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-1', name: 'Dr. Sara' }) },
    service: { findFirst: jest.fn().mockResolvedValue(mockService) },
    employeeService: { findUnique: jest.fn().mockResolvedValue({ id: 'es-1', employeeId: 'emp-1', serviceId: 'svc-1' }) },
    integration: { findFirst: jest.fn().mockResolvedValue(null) },
    serviceBookingConfig: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    serviceCategory: { findFirst: jest.fn().mockResolvedValue(null) },
    department: { findFirst: jest.fn().mockResolvedValue(null) },
    booking: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockBooking),
      count: jest.fn().mockResolvedValue(0),
    },
    invoice: { create: jest.fn().mockResolvedValue(mockInvoice) },
    organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: '0.15', paymentAtClinicEnabled: true }) },
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
    coupon: { update: jest.fn().mockResolvedValue({}) },
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn(),
  };

  // The handler chains .catch(mapDbConflict) on $transaction, so the mock
  // must return a real Promise that supports .catch().
  prisma.$transaction = jest.fn((cb: (tx: unknown) => Promise<unknown>, _opts?: unknown) =>
    Promise.resolve(cb(prisma)),
  );

  return prisma;
};

const buildPriceResolver = () => ({
  resolve: jest.fn().mockResolvedValue({
    price: 200,
    durationMins: 60,
    durationOptionId: '',
    currency: 'SAR',
    isEmployeeOverride: false,
  }),
});

const buildSettingsHandler = (overrides = {}) => ({
  execute: jest.fn().mockResolvedValue({ ...DEFAULT_BOOKING_SETTINGS, ...overrides }),
});

const buildEventBus = () => ({
  publish: jest.fn().mockResolvedValue(undefined),
});

const buildCouponValidator = () => ({
  validate: jest.fn().mockResolvedValue({ couponId: 'c-1', discount: 20 }),
});

const baseDto = {
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  serviceId: 'svc-1',
  scheduledAt: futureDate,
};

describe('CreateBookingHandler', () => {
  let handler: CreateBookingHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let rlsTransaction: { withTransaction: jest.Mock };
  let priceResolver: ReturnType<typeof buildPriceResolver>;
  let settingsHandler: ReturnType<typeof buildSettingsHandler>;
  let eventBus: ReturnType<typeof buildEventBus>;
  let couponValidator: ReturnType<typeof buildCouponValidator>;

  beforeEach(async () => {
    prisma = buildPrisma();
    priceResolver = buildPriceResolver();
    settingsHandler = buildSettingsHandler();
    eventBus = buildEventBus();
    couponValidator = buildCouponValidator();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateBookingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction = { withTransaction: jest.fn((cb: any) => cb(prisma)) } },
        { provide: PriceResolverService, useValue: priceResolver },
        { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        { provide: EventBusService, useValue: eventBus },
        { provide: ValidateCouponService, useValue: couponValidator },
      ],
    }).compile();

    handler = module.get<CreateBookingHandler>(CreateBookingHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Validation guards (pre-transaction)
  // ──────────────────────────────────────────────────────────────────────────

  it('throws BadRequestException when scheduledAt is in the past', async () => {
    await expect(
      handler.execute({ ...baseDto, scheduledAt: new Date(Date.now() - 86400_000) }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when payAtClinic=true but org settings row is missing', async () => {
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      handler.execute({ ...baseDto, payAtClinic: true }),
    ).rejects.toThrow('Pay at clinic is not enabled');
  });

  it('throws BadRequestException when payAtClinic=true but paymentAtClinicEnabled=false', async () => {
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ paymentAtClinicEnabled: false });
    await expect(
      handler.execute({ ...baseDto, payAtClinic: true }),
    ).rejects.toThrow('Pay at clinic is not enabled');
  });

  it('passes when payAtClinic=true and paymentAtClinicEnabled=true', async () => {
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ paymentAtClinicEnabled: true });
    await handler.execute({ ...baseDto, payAtClinic: true });
    expect(prisma.booking.create).toHaveBeenCalled();
  });

  it('throws NotFoundException when branch is not found', async () => {
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Branch not found');
  });

  it('throws BadRequestException when branch is inactive', async () => {
    prisma.branch.findFirst = jest.fn().mockResolvedValue({ id: 'branch-1', nameAr: 'الفرع الرئيسي', isActive: false });
    await expect(handler.execute(baseDto)).rejects.toThrow('Branch is not active');
  });

  it('throws NotFoundException when client is not found', async () => {
    prisma.client.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Client not found');
  });

  it('excludes soft-deleted clients from the booking lookup', async () => {
    await handler.execute(baseDto).catch(() => undefined);
    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('throws NotFoundException when employee is not found', async () => {
    prisma.employee.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Employee not found');
  });

  it('throws BadRequestException when employee is inactive', async () => {
    prisma.employee.findFirst = jest.fn().mockResolvedValue({ id: 'emp-1', name: 'Dr. Sara', isActive: false });
    await expect(handler.execute(baseDto)).rejects.toThrow('Employee is not active');
  });

  it('throws NotFoundException when service is not found', async () => {
    prisma.service.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Service not found');
  });

  it('throws BadRequestException when service is inactive', async () => {
    prisma.service.findFirst = jest.fn().mockResolvedValue({ ...mockService, isActive: false, archivedAt: null, isHidden: false });
    await expect(handler.execute(baseDto)).rejects.toThrow('Service is not active');
  });

  it('throws BadRequestException when service is archived', async () => {
    prisma.service.findFirst = jest.fn().mockResolvedValue({ ...mockService, isActive: true, archivedAt: new Date(), isHidden: false });
    await expect(handler.execute(baseDto)).rejects.toThrow('Service is archived');
  });

  it('throws BadRequestException when service is hidden and category is SERVICES mode', async () => {
    prisma.service.findFirst = jest.fn().mockResolvedValue({
      ...mockService,
      isActive: true,
      archivedAt: null,
      isHidden: true,
      category: { bookingMode: 'SERVICES' },
    });
    await expect(handler.execute(baseDto)).rejects.toThrow('Service is hidden');
  });

  it('throws BadRequestException when employee does not provide the service', async () => {
    prisma.employeeService.findUnique = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Employee does not provide this service');
  });

  it('throws BadRequestException when selected time is not in computed availability', async () => {
    const availabilityHandler = { execute: jest.fn().mockResolvedValue([]) };
    const guardedHandler = new CreateBookingHandler(
      prisma as any,
      rlsTransaction as any,
      priceResolver as any,
      settingsHandler as any,
      eventBus as any,
      couponValidator as any,
      availabilityHandler as any,
    );

    await expect(guardedHandler.execute(baseDto)).rejects.toThrow('Selected booking time is not available');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Individual booking transaction path
  // ──────────────────────────────────────────────────────────────────────────

  it('acquires pg_advisory_xact_lock before conflict check for individual bookings', async () => {
    const callOrder: string[] = [];
    (prisma.$executeRaw as jest.Mock).mockImplementation(async () => {
      callOrder.push('$executeRaw');
    });
    (prisma.booking.findFirst as jest.Mock).mockImplementation(async () => {
      callOrder.push('booking.findFirst');
      return null;
    });

    await handler.execute(baseDto);

    const lockIdx = callOrder.indexOf('$executeRaw');
    const findIdx = callOrder.indexOf('booking.findFirst');
    expect(lockIdx).toBeGreaterThanOrEqual(0);
    expect(findIdx).toBeGreaterThanOrEqual(0);
    expect(lockIdx).toBeLessThan(findIdx);

    const rawCall = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    expect(rawCall[0].join('')).toMatch(/pg_advisory_xact_lock/);
  });

  it('throws ConflictException when overlapping booking is found after lock', async () => {
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ id: 'existing' });
    await expect(handler.execute(baseDto)).rejects.toThrow(
      'Employee already has a booking in this time slot',
    );
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [...STAFF_TIME_BLOCKING_BOOKING_STATUSES] },
        }),
      }),
    );
  });

  it('assigns sequential bookingNumber when prior booking exists', async () => {
    // First findFirst = overlap check, second = bookingNumber lookup
    prisma.booking.findFirst = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ bookingNumber: 7 });
    prisma.booking.create = jest.fn().mockResolvedValue({ ...mockBooking, bookingNumber: 8 });

    await handler.execute(baseDto);

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bookingNumber: 8 }) }),
    );
  });

  it('starts bookingNumber at 1 when no prior bookings exist', async () => {
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    prisma.booking.create = jest.fn().mockResolvedValue({ ...mockBooking, bookingNumber: 1 });

    await handler.execute(baseDto);

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bookingNumber: 1 }) }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Invoice creation (VAT branches)
  // ──────────────────────────────────────────────────────────────────────────

  it('creates invoice with zero VAT when orgSettings is null (unregistered org)', async () => {
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue(null);
    await handler.execute(baseDto);

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.vatRate.toString()).toBe('0');
    expect(invoiceData.vatAmt.toString()).toBe('0');
    expect(invoiceData.total.toString()).toBe('200');
  });

  it('creates invoice with custom VAT when orgSettings.vatRate is set', async () => {
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ vatRate: '0.10' });
    await handler.execute(baseDto);

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.vatRate.toString()).toBe('0.1');
    expect(invoiceData.vatAmt.toString()).toBe('20');
    expect(invoiceData.total.toString()).toBe('220');
  });

  it('rounds VAT to whole halalas (no fractional halala on the invoice)', async () => {
    // 9990 halalas * 0.15 = 1498.5 → must round to a whole halala (1499).
    priceResolver.resolve = jest.fn().mockResolvedValue({
      price: 9990,
      durationMins: 60,
      durationOptionId: '',
      currency: 'SAR',
      isEmployeeOverride: false,
    });
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ vatRate: '0.15' });

    await handler.execute(baseDto);

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    // Decimals representing whole halalas — no fractional digits in string form.
    expect(invoiceData.vatAmt.toString()).toBe('1499');
    expect(invoiceData.total.toString()).toBe('11489');
  });

  it('does not create invoice when payAtClinic=true', async () => {
    await handler.execute({ ...baseDto, payAtClinic: true });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('does not create invoice when price is zero', async () => {
    priceResolver.resolve = jest.fn().mockResolvedValue({
      price: 0,
      durationMins: 60,
      durationOptionId: '',
      currency: 'SAR',
      isEmployeeOverride: false,
    });
    const result = await handler.execute(baseDto);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(result.invoiceId).toBeNull();
  });

  it('creates invoice when price is positive', async () => {
    priceResolver.resolve = jest.fn().mockResolvedValue({
      price: 100,
      durationMins: 60,
      durationOptionId: '',
      currency: 'SAR',
      isEmployeeOverride: false,
    });
    prisma.booking.create = jest.fn().mockResolvedValue({ ...mockBooking, price: 100 });
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ vatRate: '0' });
    await handler.execute(baseDto);
    expect(prisma.invoice.create).toHaveBeenCalled();
  });

  it('computes invoice VAT and total using computeVat (subtotal=10000, discount=2000, vatRate=0.15)', async () => {
    // Arrange: service priced at 10000 halalas, 20%-off coupon discounting by 2000 halalas.
    priceResolver.resolve = jest.fn().mockResolvedValue({
      price: 10000,
      durationMins: 60,
      durationOptionId: '',
      currency: 'SAR',
      isEmployeeOverride: false,
    });
    couponValidator.validate = jest.fn().mockResolvedValue({ couponId: 'c-1', discount: 2000 });
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ vatRate: '0.15' });

    await handler.execute({
      ...baseDto,
      couponCode: 'PCT20OFF',
      payAtClinic: false,
    });

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    // vatBase = 10000 - 2000 = 8000
    // vatAmt = round_half_up(8000 * 0.15) = 1200
    // total  = 8000 + 1200 = 9200
    expect(invoiceData.subtotal.toString()).toBe('10000');
    expect(invoiceData.discountAmt.toString()).toBe('2000');
    expect(invoiceData.vatAmt.toString()).toBe('1200');
    expect(invoiceData.total.toString()).toBe('9200');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Outbox event
  // ──────────────────────────────────────────────────────────────────────────

  it('writes outboxEvent inside the transaction', async () => {
    await handler.execute(baseDto);

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregateId: 'book-1',
          eventType: 'bookings.booking.created',
          payload: expect.objectContaining({ source: 'bookings' }),
        }),
      }),
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Coupon validation
  // ──────────────────────────────────────────────────────────────────────────

  it('validates coupon and increments usedCount when couponCode is provided', async () => {
    await handler.execute({ ...baseDto, couponCode: 'PROMO10' });

    expect(couponValidator.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PROMO10',
        orgId: DEFAULT_ORG_ID,
        clientId: 'client-1',
        serviceId: 'svc-1',
        subtotal: 200,
      }),
    );
    expect(prisma.coupon.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c-1' },
        data: { usedCount: { increment: 1 } },
      }),
    );
  });

  it('skips coupon logic when no couponCode is provided', async () => {
    await handler.execute(baseDto);
    expect(couponValidator.validate).not.toHaveBeenCalled();
    expect(prisma.coupon.update).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. DB exclusion constraint error mapping
  // ──────────────────────────────────────────────────────────────────────────

  it('maps Postgres 23P01 exclusion violation to ConflictException', async () => {
    const exclusionError = new Prisma.PrismaClientKnownRequestError(
      'exclusion constraint violation',
      { code: 'P2010', clientVersion: '5.0.0', meta: { code: '23P01' } },
    );
    rlsTransaction.withTransaction = jest.fn().mockRejectedValueOnce(exclusionError);

    await expect(handler.execute(baseDto)).rejects.toThrow(ConflictException);
  });

  it('re-throws non-23P01 errors from transaction', async () => {
    const otherError = new Error('some other error');
    rlsTransaction.withTransaction = jest.fn().mockRejectedValueOnce(otherError);

    await expect(handler.execute(baseDto)).rejects.toThrow('some other error');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Nullish coalescing branches (employeeId, bookingType, etc.)
  // ──────────────────────────────────────────────────────────────────────────

  it('uses noemp fallback in advisory lock when employeeId is undefined (individual)', async () => {
    const callOrder: string[] = [];
    (prisma.$executeRaw as jest.Mock).mockImplementation(async () => {
      callOrder.push('$executeRaw');
    });
    (prisma.booking.findFirst as jest.Mock).mockImplementation(async () => {
      callOrder.push('booking.findFirst');
      return null;
    });

    await handler.execute({ ...baseDto, employeeId: undefined as any });

    expect(callOrder.indexOf('$executeRaw')).toBeGreaterThanOrEqual(0);
  });

  it('defaults bookingType to INDIVIDUAL when not provided', async () => {
    await handler.execute({ ...baseDto, bookingType: undefined });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bookingType: 'INDIVIDUAL' }),
      }),
    );
  });

  it('defaults payAtClinic to false when not provided', async () => {
    await handler.execute({ ...baseDto, payAtClinic: undefined });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ payAtClinic: false }),
      }),
    );
  });

  it('defaults couponCode to null when not provided', async () => {
    await handler.execute({ ...baseDto, couponCode: undefined });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ couponCode: null }),
      }),
    );
  });

  it('creates a dashboard booking as CONFIRMED with confirmedAt set', async () => {
    await handler.execute(baseDto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
          confirmedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('does not set a payment-expiry window on a confirmed booking', async () => {
    // CONFIRMED bookings carry no expiresAt — EXPIRE only acts on unconfirmed ones.
    await handler.execute(baseDto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: undefined }),
      }),
    );
  });

  it('does not set expiresAt when payAtClinic=true', async () => {
    await handler.execute({ ...baseDto, payAtClinic: true });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: undefined }),
      }),
    );
  });

  it('uses durationOptionId from resolver when empty string', async () => {
    priceResolver.resolve = jest.fn().mockResolvedValue({
      price: 200,
      durationMins: 60,
      durationOptionId: '',
      currency: 'SAR',
      isEmployeeOverride: false,
    });
    await handler.execute(baseDto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ durationOptionId: null }),
      }),
    );
  });

  it('uses resolved durationOptionId when present', async () => {
    priceResolver.resolve = jest.fn().mockResolvedValue({
      price: 200,
      durationMins: 60,
      durationOptionId: 'opt-1',
      currency: 'SAR',
      isEmployeeOverride: false,
    });
    await handler.execute(baseDto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ durationOptionId: 'opt-1' }),
      }),
    );
  });

  it('handles null employeeId in BookingCreatedEvent payload', async () => {
    prisma.booking.create = jest.fn().mockResolvedValue({
      ...mockBooking,
      employeeId: null,
    });
    await handler.execute(baseDto);
    expect(prisma.outboxEvent.create).toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. DeliveryType + Snapshots (TDD — refactor-booking-delivery-type)
  // ──────────────────────────────────────────────────────────────────────────

  it('persists deliveryType correctly when provided', async () => {
    await handler.execute({ ...baseDto, deliveryType: 'ONLINE' as any });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveryType: 'ONLINE' }),
      }),
    );
  });

  it('persists snapshot fields at booking creation', async () => {
    prisma.service.findFirst = jest.fn().mockResolvedValue({
      id: 'svc-1',
      nameAr: 'استشارة',
      categoryId: 'cat-1',
      durationMins: 60,
      price: 200,
      currency: 'SAR',
    });
    prisma.serviceCategory.findFirst = jest.fn().mockResolvedValue({
      id: 'cat-1',
      nameAr: 'الاستشارات',
      departmentId: 'dept-1',
    });
    prisma.department.findFirst = jest.fn().mockResolvedValue({
      id: 'dept-1',
      nameAr: 'الأقسام الطبية',
    });

    await handler.execute(baseDto);

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceSnapshot: expect.any(Prisma.Decimal),
          durationMinutesSnapshot: 60,
          branchNameSnapshot: 'الفرع الرئيسي',
          employeeNameSnapshot: 'Dr. Sara',
          serviceNameSnapshot: 'استشارة',
          categoryNameSnapshot: 'الاستشارات',
          departmentNameSnapshot: 'الأقسام الطبية',
        }),
      }),
    );
  });

  it('does NOT auto-create Zoom for ONLINE booking (Zoom is opt-in only)', async () => {
    prisma.integration.findFirst = jest.fn().mockResolvedValue({ id: 'zoom-1', isActive: true });
    await handler.execute({ ...baseDto, deliveryType: 'ONLINE' as any });
    // Zoom fields should NOT be populated automatically
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          zoomMeetingId: expect.anything(),
          zoomJoinUrl: expect.anything(),
        }),
      }),
    );
  });

  it('maps legacy bookingType=ONLINE to individual online booking without requiring Zoom', async () => {
    prisma.integration.findFirst = jest.fn().mockResolvedValue(null);

    await handler.execute({ ...baseDto, bookingType: 'ONLINE' as any });

    expect(prisma.integration.findFirst).not.toHaveBeenCalled();
    expect(priceResolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingType: 'INDIVIDUAL',
        deliveryType: 'ONLINE',
      }),
    );
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingType: 'INDIVIDUAL',
          deliveryType: 'ONLINE',
        }),
      }),
    );
  });

  it('never creates Zoom for IN_PERSON booking', async () => {
    await handler.execute({ ...baseDto, deliveryType: 'IN_PERSON' as any });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          zoomMeetingId: expect.anything(),
          zoomJoinUrl: expect.anything(),
        }),
      }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. DIRECT category — hidden service booking guard
  // ──────────────────────────────────────────────────────────────────────────

  it('allows booking a hidden service when category bookingMode is DIRECT', async () => {
    prisma.service.findFirst = jest.fn().mockResolvedValue({
      ...mockService,
      isActive: true,
      archivedAt: null,
      isHidden: true,
      categoryId: 'cat-direct',
      category: { bookingMode: 'DIRECT' },
    });
    await expect(handler.execute(baseDto)).resolves.toBeDefined();
    expect(prisma.booking.create).toHaveBeenCalled();
  });

  it('rejects booking a hidden service when category bookingMode is SERVICES', async () => {
    prisma.service.findFirst = jest.fn().mockResolvedValue({
      ...mockService,
      isActive: true,
      archivedAt: null,
      isHidden: true,
      categoryId: 'cat-services',
      category: { bookingMode: 'SERVICES' },
    });
    await expect(handler.execute(baseDto)).rejects.toThrow('Service is hidden');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rejects duration option mismatch with deliveryType', async () => {
    priceResolver.resolve = jest.fn().mockRejectedValue(
      new BadRequestException('Duration option delivery type (IN_PERSON) does not match requested delivery type (ONLINE)'),
    );

    await expect(
      handler.execute({ ...baseDto, deliveryType: 'ONLINE' as any, durationOptionId: 'opt-inperson' }),
    ).rejects.toThrow(/does not match requested delivery type/);
  });

  it('defaults WALK_IN bookingType to IN_PERSON deliveryType', async () => {
    await handler.execute({ ...baseDto, bookingType: 'WALK_IN' as any });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingType: 'WALK_IN',
          deliveryType: 'IN_PERSON',
        }),
      }),
    );
  });

  it('passes deliveryType to PriceResolverService', async () => {
    await handler.execute({ ...baseDto, deliveryType: 'ONLINE' as any });
    expect(priceResolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'svc-1',
        employeeServiceId: 'es-1',
        durationOptionId: null,
        bookingType: 'INDIVIDUAL',
        deliveryType: 'ONLINE',
      }),
    );
  });

  // ─── Track B — practitioner ↔ service integrity ────────────────────────────
  // The EmployeeService link is the "specialty match" in this codebase
  // (no separate Specialty entity). Its isActive=false flag is the way an
  // admin removes a practitioner's qualification for a service. A booking
  // must never be created through a disabled link.

  it('throws BadRequestException when the employee→service link is soft-disabled (isActive=false)', async () => {
    prisma.employeeService.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'es-1', employeeId: 'emp-1', serviceId: 'svc-1', isActive: false });
    await expect(handler.execute(baseDto)).rejects.toThrow('Employee does not provide this service');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rejects a non-owned durationOptionId for a custom-pricing practitioner (no charging the inherited base price)', async () => {
    prisma.employeeService.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'es-1', employeeId: 'emp-1', serviceId: 'svc-1', isActive: true, useCustomPricing: true });
    // Ownership lookup scoped by the passed id finds no owned row → not one of the practitioner's options.
    (prisma as any).serviceDurationOption = { findFirst: jest.fn().mockResolvedValue(null) };

    await expect(
      handler.execute({ ...baseDto, deliveryType: 'IN_PERSON' as any, durationOptionId: 'svc-default-opt' }),
    ).rejects.toThrow('Selected duration option is not offered by this practitioner');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rejects a scheduled time that falls outside business hours (no availability)', async () => {
    // Simulate the availability check returning [] so the guard fires.
    const availabilityHandler = {
      execute: jest.fn().mockResolvedValue([]),
    };
    const guardedHandler = new CreateBookingHandler(
      prisma as any,
      rlsTransaction as any,
      priceResolver as any,
      settingsHandler as any,
      eventBus as any,
      couponValidator as any,
      availabilityHandler as any,
    );
    await expect(guardedHandler.execute(baseDto)).rejects.toThrow('Selected booking time is not available');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Channel gate — serviceBookingConfig isActive filter (#11)
  // ──────────────────────────────────────────────────────────────────────────

  it('rejects deliveryType blocked only by an INACTIVE config (channel gate only counts active configs)', async () => {
    // Active config for IN_PERSON only; ONLINE config exists but is inactive.
    prisma.serviceBookingConfig.findMany = jest.fn().mockResolvedValue([
      { deliveryType: 'IN_PERSON' },
    ]);

    await expect(
      handler.execute({ ...baseDto, deliveryType: 'ONLINE' as any }),
    ).rejects.toThrow('Service does not support ONLINE delivery type');
  });

  it('allows deliveryType when its config is active (channel gate passes)', async () => {
    prisma.serviceBookingConfig.findMany = jest.fn().mockResolvedValue([
      { deliveryType: 'IN_PERSON' },
      { deliveryType: 'ONLINE' },
    ]);

    await expect(
      handler.execute({ ...baseDto, deliveryType: 'ONLINE' as any }),
    ).resolves.toBeDefined();
  });

  it('passes findMany with isActive: true to channel gate query', async () => {
    await handler.execute({ ...baseDto, bookingType: 'APPOINTMENT' as any, deliveryType: 'IN_PERSON' as any });

    expect(prisma.serviceBookingConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 13. Source field + ONLINE booking status/expiry/invoice (#7 + #6)
  // ──────────────────────────────────────────────────────────────────────────

  it('persists source=RECEPTION when no source is provided (dashboard default)', async () => {
    await handler.execute(baseDto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'RECEPTION' }),
      }),
    );
  });

  it('persists source=ONLINE when source=ONLINE is passed', async () => {
    await handler.execute({ ...baseDto, source: 'ONLINE' });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'ONLINE' }),
      }),
    );
  });

  it('creates ONLINE paid booking as AWAITING_PAYMENT with expiresAt when price > 0 and no payAtClinic', async () => {
    // price > 0, no payAtClinic, not group, source=ONLINE → AWAITING_PAYMENT
    prisma.booking.create = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: 'AWAITING_PAYMENT',
      source: 'ONLINE',
    });

    await handler.execute({ ...baseDto, source: 'ONLINE' });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'AWAITING_PAYMENT',
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it('does not set confirmedAt for AWAITING_PAYMENT ONLINE booking', async () => {
    await handler.execute({ ...baseDto, source: 'ONLINE' });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confirmedAt: undefined,
        }),
      }),
    );
  });

  it('creates DRAFT invoice for AWAITING_PAYMENT ONLINE booking so init-payment can proceed', async () => {
    // AWAITING_PAYMENT bookings need an invoice at creation time — init-client-payment
    // throws 404 if invoiceId is null. It stays DRAFT ("awaiting payment") until the
    // first COMPLETED payment stamps issuedAt and flips it. @@unique([bookingId]) prevents dupes.
    prisma.booking.create = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: 'AWAITING_PAYMENT',
      source: 'ONLINE',
    });

    const result = await handler.execute({ ...baseDto, source: 'ONLINE' });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: mockBooking.id,
          status: 'DRAFT',
        }),
      }),
    );
    expect(result.invoiceId).toBe('invoice-1');
  });

  it('creates ONLINE booking as CONFIRMED when payAtClinic=true (no payment needed)', async () => {
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ paymentAtClinicEnabled: true, vatRate: '0' });
    await handler.execute({ ...baseDto, source: 'ONLINE', payAtClinic: true });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
          confirmedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('creates ONLINE booking as CONFIRMED when price=0 (free service)', async () => {
    priceResolver.resolve = jest.fn().mockResolvedValue({
      price: 0,
      durationMins: 60,
      durationOptionId: '',
      currency: 'SAR',
      isEmployeeOverride: false,
    });
    prisma.booking.create = jest.fn().mockResolvedValue({ ...mockBooking, price: 0, status: 'CONFIRMED' });

    await handler.execute({ ...baseDto, source: 'ONLINE' });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
        }),
      }),
    );
  });

  it('creates dashboard booking (no source) as CONFIRMED regardless of price', async () => {
    // This is the original dashboard path — must not regress.
    await handler.execute(baseDto); // no source field
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
          source: 'RECEPTION',
        }),
      }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 14. Service-level minLeadMinutes override (ORG-001, P0)
  // check-availability already honors service.minLeadMinutes; create-booking
  // must agree — otherwise a client can POST a booking that violates the
  // service's own lead time even though availability hides those slots.
  // ──────────────────────────────────────────────────────────────────────────

  it('rejects booking 60 min ahead when service.minLeadMinutes=240 (service override stricter than global)', async () => {
    // Service carries its own 4-hour lead rule; global is 60 min.
    prisma.service.findFirst = jest.fn().mockResolvedValue({ ...mockService, minLeadMinutes: 240 });
    const sixtyMinAhead = new Date(Date.now() + 60 * 60_000);

    await expect(
      handler.execute({ ...baseDto, scheduledAt: sixtyMinAhead }),
    ).rejects.toThrow(/at least 240 minutes in advance/);
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('accepts booking 4 hours ahead when service.minLeadMinutes=240 (within override)', async () => {
    // 4 hours + 5 min cushion — handler recomputes `now` after the test sets
    // scheduledAt, so a tiny gap between the two `Date.now()` calls can
    // otherwise flip a 240-min target into a 239-min violation.
    prisma.service.findFirst = jest.fn().mockResolvedValue({ ...mockService, minLeadMinutes: 240 });
    const fourHoursAhead = new Date(Date.now() + (4 * 60 + 5) * 60_000);

    await expect(
      handler.execute({ ...baseDto, scheduledAt: fourHoursAhead }),
    ).resolves.toBeDefined();
    expect(prisma.booking.create).toHaveBeenCalled();
  });

  it('falls back to global minBookingLeadMinutes when service has no minLeadMinutes override', async () => {
    // Global default (DEFAULT_BOOKING_SETTINGS.minBookingLeadMinutes = 60).
    // 30 min ahead is less than 60 → must reject via the global fallback.
    const thirtyMinAhead = new Date(Date.now() + 30 * 60_000);

    await expect(
      handler.execute({ ...baseDto, scheduledAt: thirtyMinAhead }),
    ).rejects.toThrow(/at least 60 minutes in advance/);
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });
});
