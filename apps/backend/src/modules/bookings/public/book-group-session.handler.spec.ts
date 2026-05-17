import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { GroupSessionStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { BookGroupSessionHandler } from './book-group-session.handler';

function createSession(overrides?: Partial<any>) {
  return {
    id: 'gs1',
    isPublic: true,
    status: GroupSessionStatus.OPEN,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    maxCapacity: 10,
    enrolledCount: 5,
    waitlistEnabled: true,
    price: 100,
    currency: 'SAR',
    employeeId: 'emp1',
    serviceId: 'svc1',
    branchId: 'branch1',
    ...overrides,
  };
}

describe('BookGroupSessionHandler', () => {
  let handler: BookGroupSessionHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      groupSession: { findFirst: jest.fn(), update: jest.fn() },
      groupEnrollment: { findUnique: jest.fn(), create: jest.fn() },
      groupSessionWaitlist: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      booking: { findFirst: jest.fn(), create: jest.fn() },
      invoice: { create: jest.fn() },
      organizationSettings: { findFirst: jest.fn() },
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

  it('should throw when already on waitlist', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession());
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue({ id: 'w1' });
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(ConflictException);
  });

  it('should create booking when spots available', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 5, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue({ bookingNumber: 'BK-099' });
    prisma.booking.create.mockResolvedValue({ id: 'b1', bookingNumber: 'BK-001' });
    prisma.invoice.create.mockResolvedValue({ id: 'inv1' });
    prisma.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0.15' });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.update.mockResolvedValue({});

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(result.type).toBe('BOOKED');
    expect(result.bookingId).toBe('b1');
    expect(prisma.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiresAt: expect.any(Date) }),
    }));
  });

  it('should create free booking without expiry', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ price: 0, enrolledCount: 5, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({ id: 'b1', bookingNumber: 'BK-002' });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.update.mockResolvedValue({});

    await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(prisma.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiresAt: null }),
    }));
  });

  it('should add to waitlist when full and waitlist enabled', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 10, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findFirst.mockResolvedValue({ position: 3 });
    prisma.groupSessionWaitlist.create.mockResolvedValue({});
    prisma.groupSession.update.mockResolvedValue({});

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(result.type).toBe('WAITLISTED');
    expect(result.waitlistPosition).toBe(4);
  });

  it('should add to waitlist at position 1 when no existing entries', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 10, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findFirst.mockResolvedValue(null);
    prisma.groupSessionWaitlist.create.mockResolvedValue({});
    prisma.groupSession.update.mockResolvedValue({});

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(result.waitlistPosition).toBe(1);
  });

  it('should throw when full and waitlist disabled', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 10, maxCapacity: 10, waitlistEnabled: false }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(BadRequestException);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Invoice creation for paid group-session bookings
  // ──────────────────────────────────────────────────────────────────────────

  it('creates a Booking AND an Invoice for a paid group session', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(
      createSession({ price: 12000, enrolledCount: 5, maxCapacity: 10 }),
    );
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
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
    prisma.groupSession.update.mockResolvedValue({});

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

  it('defaults VAT to 0.15 when organizationSettings is absent', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(
      createSession({ price: 12000, enrolledCount: 5, maxCapacity: 10 }),
    );
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
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
    prisma.groupSession.update.mockResolvedValue({});

    await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vatRate: 0.15, vatAmt: 1800, total: 13800 }),
      }),
    );
  });

  it('does NOT create an Invoice for a free group session', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(
      createSession({ price: 0, enrolledCount: 5, maxCapacity: 10 }),
    );
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
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
    prisma.groupSession.update.mockResolvedValue({});

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
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
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
    prisma.groupSession.update.mockResolvedValue({});

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
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
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
    prisma.groupSession.update.mockResolvedValue({});

    await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
