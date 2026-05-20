import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateBookingHandler } from './create-booking.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { PriceResolverService } from '../../org-experience/services/price-resolver.service';
import { GetBookingSettingsHandler, DEFAULT_BOOKING_SETTINGS } from '../get-booking-settings/get-booking-settings.handler';
import { GroupSessionMinReachedHandler } from '../group-session-min-reached/group-session-min-reached.handler';
import { EventBusService } from '../../../infrastructure/events';
import { ValidateCouponService } from '../coupons/validate-coupon.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';

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
    organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: '0.15' }) },
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

const buildGroupMinReachedHandler = () => ({
  execute: jest.fn().mockResolvedValue(undefined),
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
  let groupMinReachedHandler: ReturnType<typeof buildGroupMinReachedHandler>;
  let eventBus: ReturnType<typeof buildEventBus>;
  let couponValidator: ReturnType<typeof buildCouponValidator>;

  beforeEach(async () => {
    prisma = buildPrisma();
    priceResolver = buildPriceResolver();
    settingsHandler = buildSettingsHandler();
    groupMinReachedHandler = buildGroupMinReachedHandler();
    eventBus = buildEventBus();
    couponValidator = buildCouponValidator();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateBookingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction = { withTransaction: jest.fn((cb: any) => cb(prisma)) } },
        { provide: PriceResolverService, useValue: priceResolver },
        { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        { provide: GroupSessionMinReachedHandler, useValue: groupMinReachedHandler },
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

  it('throws BadRequestException when payAtClinic=true but setting key is missing', async () => {
    settingsHandler.execute = jest.fn().mockResolvedValue({ maxAdvanceBookingDays: 60 });
    await expect(
      handler.execute({ ...baseDto, payAtClinic: true }),
    ).rejects.toThrow('Pay at clinic is not enabled for this branch');
  });

  it('throws BadRequestException when payAtClinic=true but payAtClinicEnabled=false', async () => {
    settingsHandler.execute = jest.fn().mockResolvedValue({ payAtClinicEnabled: false });
    await expect(
      handler.execute({ ...baseDto, payAtClinic: true }),
    ).rejects.toThrow('Pay at clinic is not enabled for this branch');
  });

  it('passes when payAtClinic=true and payAtClinicEnabled=true', async () => {
    settingsHandler.execute = jest.fn().mockResolvedValue({ payAtClinicEnabled: true });
    await handler.execute({ ...baseDto, payAtClinic: true });
    expect(prisma.booking.create).toHaveBeenCalled();
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

  it('throws NotFoundException when service is not found', async () => {
    prisma.service.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(baseDto)).rejects.toThrow('Service not found');
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
      groupMinReachedHandler as any,
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

  it('creates invoice with default VAT (0.15) when orgSettings is null', async () => {
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue(null);
    await handler.execute(baseDto);

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vatRate: 0.15,
          vatAmt: 30,
          total: 230,
        }),
        select: { id: true },
      }),
    );
  });

  it('creates invoice with custom VAT when orgSettings.vatRate is set', async () => {
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ vatRate: '0.10' });
    await handler.execute(baseDto);

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vatRate: 0.10,
          vatAmt: 20,
          total: 220,
        }),
        select: { id: true },
      }),
    );
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
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue(null);

    await handler.execute(baseDto);

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    expect(Number.isInteger(invoiceData.vatAmt)).toBe(true);
    expect(invoiceData.vatAmt).toBe(1499);
    expect(invoiceData.total).toBe(11489);
  });

  it('does not create invoice when payAtClinic=true', async () => {
    settingsHandler.execute = jest.fn().mockResolvedValue({ payAtClinicEnabled: true });
    await handler.execute({ ...baseDto, payAtClinic: true });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
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
  // 6. Group service transaction path
  // ──────────────────────────────────────────────────────────────────────────

  const setupGroupService = () => {
    prisma.service.findFirst = jest
      .fn()
      .mockResolvedValueOnce(mockService) // first call (basic service lookup)
      .mockResolvedValueOnce({
        id: 'svc-1',
        minParticipants: 2,
        maxParticipants: 5,
        reserveWithoutPayment: true,
      });
    prisma.booking.create = jest.fn().mockResolvedValue({
      ...mockBooking,
      bookingType: 'GROUP',
      status: 'PENDING_GROUP_FILL',
    });
  };

  it('takes pg_advisory_xact_lock before capacity check for group bookings', async () => {
    setupGroupService();

    const callOrder: string[] = [];
    (prisma.$executeRaw as jest.Mock).mockImplementation(async () => {
      callOrder.push('$executeRaw');
    });
    (prisma.booking.count as jest.Mock).mockImplementation(async () => {
      callOrder.push('booking.count');
      return 0;
    });

    await handler.execute(baseDto);

    expect(callOrder.indexOf('$executeRaw')).toBeLessThan(callOrder.indexOf('booking.count'));

    const rawCall = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    expect(rawCall[0].join('')).toMatch(/pg_advisory_xact_lock/);
  });

  it('allows group booking when capacity is below maxParticipants', async () => {
    setupGroupService();
    prisma.booking.count = jest.fn().mockResolvedValue(3);

    const result = await handler.execute(baseDto);

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_GROUP_FILL', bookingType: 'GROUP' }),
      }),
    );
    expect(result.invoiceId).toBeNull();
  });

  it('throws ConflictException when group session is full', async () => {
    setupGroupService();
    prisma.booking.count = jest.fn().mockResolvedValue(5);

    await expect(handler.execute(baseDto)).rejects.toThrow('This group session is full');
  });

  it('does not create invoice for pending group session', async () => {
    setupGroupService();
    prisma.booking.count = jest.fn().mockResolvedValue(0);

    await handler.execute(baseDto);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Post-transaction: groupMinReachedHandler
  // ──────────────────────────────────────────────────────────────────────────

  it('calls groupMinReachedHandler when minParticipants is reached post-tx', async () => {
    setupGroupService();
    prisma.booking.count = jest
      .fn()
      .mockResolvedValueOnce(0) // capacity check inside tx
      .mockResolvedValueOnce(2); // post-tx count (minParticipants=2)

    await handler.execute(baseDto);

    expect(groupMinReachedHandler.execute).toHaveBeenCalledWith({
      serviceId: 'svc-1',
      employeeId: 'emp-1',
      scheduledAt: expect.any(Date),
    });
  });

  it('does not call groupMinReachedHandler when minParticipants is not reached', async () => {
    setupGroupService();
    prisma.booking.count = jest
      .fn()
      .mockResolvedValueOnce(0) // capacity check inside tx
      .mockResolvedValueOnce(1); // post-tx count (minParticipants=2)

    await handler.execute(baseDto);

    expect(groupMinReachedHandler.execute).not.toHaveBeenCalled();
  });

  it('swallows groupMinReachedHandler rejection', async () => {
    setupGroupService();
    groupMinReachedHandler.execute.mockRejectedValue(new Error('fail'));
    prisma.booking.count = jest
      .fn()
      .mockResolvedValueOnce(0) // capacity check inside tx
      .mockResolvedValueOnce(2); // post-tx count (minParticipants=2)

    await expect(handler.execute(baseDto)).resolves.not.toThrow();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. DB exclusion constraint error mapping
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

  it('uses noemp fallback in advisory lock when employeeId is undefined (group)', async () => {
    setupGroupService();
    const callOrder: string[] = [];
    (prisma.$executeRaw as jest.Mock).mockImplementation(async () => {
      callOrder.push('$executeRaw');
    });
    (prisma.booking.count as jest.Mock).mockImplementation(async () => {
      callOrder.push('booking.count');
      return 0;
    });

    await handler.execute({ ...baseDto, employeeId: undefined as any });

    expect(callOrder.indexOf('$executeRaw')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('booking.count')).toBeGreaterThanOrEqual(0);
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

  it('uses provided expiresAt instead of default', async () => {
    const customExpiry = new Date(Date.now() + 3600_000);
    await handler.execute({ ...baseDto, expiresAt: customExpiry });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: customExpiry }),
      }),
    );
  });

  it('computes default expiresAt when not provided and not payAtClinic', async () => {
    await handler.execute(baseDto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it('does not set expiresAt when payAtClinic=true and no expiresAt provided', async () => {
    settingsHandler.execute = jest.fn().mockResolvedValue({ payAtClinicEnabled: true });
    await handler.execute({ ...baseDto, payAtClinic: true });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ expiresAt: expect.anything() }),
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

  it('rejects duration option mismatch with deliveryType', async () => {
    priceResolver.resolve = jest.fn().mockRejectedValue(
      new BadRequestException('Duration option delivery type (IN_PERSON) does not match requested delivery type (ONLINE)'),
    );

    await expect(
      handler.execute({ ...baseDto, deliveryType: 'ONLINE' as any, durationOptionId: 'opt-inperson' }),
    ).rejects.toThrow(/does not match requested delivery type/);
  });

  it('allows GROUP + ONLINE combination', async () => {
    setupGroupService();
    prisma.booking.count = jest.fn().mockResolvedValue(0);

    const result = await handler.execute({
      ...baseDto,
      bookingType: 'GROUP' as any,
      deliveryType: 'ONLINE' as any,
    });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingType: 'GROUP',
          deliveryType: 'ONLINE',
        }),
      }),
    );
    expect(result.status).toBe('PENDING_GROUP_FILL');
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
});
