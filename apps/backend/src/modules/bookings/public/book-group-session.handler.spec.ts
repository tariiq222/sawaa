import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { GroupSessionStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BookGroupSessionHandler } from './book-group-session.handler';

function createSession(overrides?: Partial<any>) {
  return {
    id: 'gs1',
    isPublic: true,
    status: GroupSessionStatus.OPEN,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    maxCapacity: 10,
    enrolledCount: 5,
    price: 100,
    currency: 'SAR',
    employeeId: 'emp1',
    serviceId: 'svc1',
    branchId: 'branch1',
    durationMins: 75,
    ...overrides,
  };
}

describe('BookGroupSessionHandler', () => {
  let handler: BookGroupSessionHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      groupSession: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      groupEnrollment: { findUnique: jest.fn(), create: jest.fn() },
      booking: { findFirst: jest.fn(), create: jest.fn() },
      invoice: { create: jest.fn() },
      organizationSettings: { findFirst: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(),
    };
    // Run the transaction callback with prisma itself as the tx client.
    prisma.$transaction = jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
      Promise.resolve(cb(prisma)),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookGroupSessionHandler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
            withBypassTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
          },
        },
      ],
    }).compile();

    handler = module.get<BookGroupSessionHandler>(BookGroupSessionHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when session not found', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(NotFoundException);
  });

  it('should throw when session already started', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ scheduledAt: new Date(Date.now() - 1000) }));
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(BadRequestException);
  });

  it('should throw when already enrolled', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession());
    prisma.groupEnrollment.findUnique.mockResolvedValue({ id: 'e1' });
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException when session is full', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 10, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(ConflictException);
  });

  it('should create booking when spots available', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 5, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue({ bookingNumber: 99 });
    prisma.booking.create.mockResolvedValue({ id: 'b1', bookingNumber: 100 });
    prisma.invoice.create.mockResolvedValue({ id: 'inv1' });
    prisma.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0.15' });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.updateMany.mockResolvedValue({ count: 1 });

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(result.type).toBe('BOOKED');
    expect(result.bookingId).toBe('b1');
    expect(prisma.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiresAt: expect.any(Date), bookingNumber: 100 }),
    }));
    expect(prisma.groupSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'gs1',
        status: GroupSessionStatus.OPEN,
        enrolledCount: { lt: 10 },
      }),
    }));
  });

  it('should create free booking without expiry', async () => {
    const session = createSession({ price: 0, enrolledCount: 5, maxCapacity: 10, durationMins: 75 });
    prisma.groupSession.findFirst.mockResolvedValue(session);
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({ id: 'b1', bookingNumber: 1 });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(prisma.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        expiresAt: null,
        durationMins: 75,
        endsAt: new Date(session.scheduledAt.getTime() + 75 * 60_000),
      }),
    }));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Invoice creation for paid group-session bookings
  // ──────────────────────────────────────────────────────────────────────────

  it('creates a Booking AND an Invoice for a paid group session', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(
      createSession({ price: 12000, enrolledCount: 5, maxCapacity: 10 }),
    );
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({
      id: 'b1',
      branchId: 'branch1',
      clientId: 'c1',
      employeeId: 'emp1',
      currency: 'SAR',
      status: 'AWAITING_PAYMENT',
    });
    prisma.invoice.create.mockResolvedValue({ id: 'inv1' });
    prisma.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0.15' });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.updateMany.mockResolvedValue({ count: 1 });

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });

    expect(result.type).toBe('BOOKED');
    expect(result.bookingId).toBe('b1');

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AWAITING_PAYMENT', price: 12000 }),
      }),
    );

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'b1',
          subtotal: 12000,
          discountAmt: 0,
          vatRate: 0.15,
          vatAmt: 1800,
          total: 13800,
          status: 'ISSUED',
        }),
      }),
    );
  });

  it('applies zero VAT when organizationSettings is absent (unregistered org)', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(
      createSession({ price: 12000, enrolledCount: 5, maxCapacity: 10 }),
    );
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({
      id: 'b1',
      branchId: 'branch1',
      clientId: 'c1',
      employeeId: 'emp1',
      currency: 'SAR',
      status: 'AWAITING_PAYMENT',
    });
    prisma.invoice.create.mockResolvedValue({ id: 'inv1' });
    prisma.organizationSettings.findFirst.mockResolvedValue(null);
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vatRate: 0, vatAmt: 0, total: 12000 }),
      }),
    );
  });

  it('does NOT create an Invoice for a free group session', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(
      createSession({ price: 0, enrolledCount: 5, maxCapacity: 10 }),
    );
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({
      id: 'b1',
      branchId: 'branch1',
      clientId: 'c1',
      employeeId: 'emp1',
      currency: 'SAR',
      status: 'CONFIRMED',
    });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CONFIRMED', expiresAt: null }),
      }),
    );
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('rounds VAT to whole halalas for paid group bookings', async () => {
    // 9990 halalas * 0.15 = 1498.5 → must round to a whole halala.
    prisma.groupSession.findFirst.mockResolvedValue(
      createSession({ price: 9990, enrolledCount: 5, maxCapacity: 10 }),
    );
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({
      id: 'b1',
      branchId: 'branch1',
      clientId: 'c1',
      employeeId: 'emp1',
      currency: 'SAR',
      status: 'AWAITING_PAYMENT',
    });
    prisma.invoice.create.mockResolvedValue({ id: 'inv1' });
    prisma.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0.15' });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    expect(Number.isInteger(invoiceData.vatAmt)).toBe(true);
    expect(invoiceData.vatAmt).toBe(1499);
    expect(invoiceData.total).toBe(11489);
  });

  it('wraps booking + invoice + enrollment in a single transaction', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(
      createSession({ price: 12000, enrolledCount: 5, maxCapacity: 10 }),
    );
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({
      id: 'b1',
      branchId: 'branch1',
      clientId: 'c1',
      employeeId: 'emp1',
      currency: 'SAR',
      status: 'AWAITING_PAYMENT',
    });
    prisma.invoice.create.mockResolvedValue({ id: 'inv1' });
    prisma.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0.15' });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });

    // Booking, invoice, and enrollment must all be created as part of the handler's
    // transactional flow (via rlsTransaction.withTransaction, not prisma.$transaction).
    expect(prisma.booking.create).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(prisma.groupEnrollment.create).toHaveBeenCalledTimes(1);
  });

  it('throws ConflictException when capacity reservation loses the race', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 9, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(ConflictException);
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });
});
