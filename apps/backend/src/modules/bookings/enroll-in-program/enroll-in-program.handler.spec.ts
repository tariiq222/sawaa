import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProgramStatus, BookingStatus, DeliveryType, Prisma } from '@prisma/client';
import {
  EnrollInProgramHandler,
  PROGRAM_DATE_PLACEHOLDER,
} from './enroll-in-program.handler';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

describe('EnrollInProgramHandler', () => {
  let handler: EnrollInProgramHandler;
  let prisma: any;
  let rlsTransaction: any;
  let eventBus: { publish: jest.Mock; publishOptional: jest.Mock };
  let tx: any;

  beforeEach(async () => {
    tx = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray, id: string) => {
        const sql = strings.join(' ');
        if (sql.includes('"Client"')) return [{ id, isActive: true, deletedAt: null }];
        if (sql.includes('"Employee"')) return [{ id, isActive: true }];
        return [];
      }),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      program: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockImplementation(({ select }: { select?: Record<string, unknown> }) =>
          select?.status
            ? Promise.resolve({
                status: ProgramStatus.OPEN,
                enrolledCount: 0,
                maxParticipants: 10,
                minParticipants: 1,
              })
            : Promise.resolve({ enrolledCount: 4, minParticipants: 4 })),
        update: jest.fn().mockResolvedValue({}),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({ bookingNumber: 5 }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'book-1',
            status: data.status,
            branchId: data.branchId,
            clientId: data.clientId,
            employeeId: data.employeeId,
            currency: data.currency,
          }),
        ),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      programEnrollment: {
        create: jest.fn().mockResolvedValue({ id: 'pe-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      organizationSettings: {
        findFirst: jest.fn().mockResolvedValue({ vatRate: '0' }),
      },
    };

    prisma = {
      program: {
        findFirst: jest.fn(),
      },
      programEnrollment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    rlsTransaction = {
      withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishOptional: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollInProgramHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<EnrollInProgramHandler>(EnrollInProgramHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundException when the program does not exist', async () => {
    prisma.program.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ programId: 'missing', clientId: 'client-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects enrollment when the program is not open (DRAFT/COMPLETED/CANCELLED)', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.DRAFT,
      enrolledCount: 0,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.program.findUnique.mockResolvedValue({
      status: ProgramStatus.DRAFT,
      enrolledCount: 0,
      maxParticipants: 10,
      minParticipants: 1,
    });
    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects enrollment when the program is SCHEDULED (locked for new enrollments)', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.SCHEDULED,
      enrolledCount: 0,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.program.findUnique.mockResolvedValue({
      status: ProgramStatus.SCHEDULED,
      enrolledCount: 0,
      maxParticipants: 10,
      minParticipants: 1,
    });
    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects public enrollment when the program is not public', async () => {
    prisma.program.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1', public: true }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.program.findFirst).toHaveBeenCalledWith({
      where: { id: 'prog-1', isPublic: true },
      include: expect.any(Object),
    });
  });

  it('rejects enrollment when the program has no supervisor', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 0,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [],
    });
    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('resumes an active paid enrollment even when the program is full', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 10,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.programEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      programId: 'prog-1',
      clientId: 'client-1',
      bookingId: 'book-existing',
      booking: {
        id: 'book-existing',
        programId: 'prog-1',
        clientId: 'client-1',
        status: BookingStatus.AWAITING_PAYMENT,
        price: new Prisma.Decimal(10000),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    tx.invoice.findUnique.mockResolvedValue({ id: 'inv-existing' });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).resolves.toEqual({
      type: 'ENROLLED',
      bookingId: 'book-existing',
      status: BookingStatus.AWAITING_PAYMENT,
      invoiceId: 'inv-existing',
    });
    expect(prisma.programEnrollment.findUnique).not.toHaveBeenCalled();
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.program.updateMany).not.toHaveBeenCalled();
    expect(eventBus.publishOptional).not.toHaveBeenCalled();
  });

  it('resumes an active free enrollment without creating a second invoice or booking', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.MIN_REACHED,
      enrolledCount: 2,
      maxParticipants: 2,
      price: new Prisma.Decimal(0),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.programEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      programId: 'prog-1',
      clientId: 'client-1',
      bookingId: 'book-existing',
      booking: {
        id: 'book-existing',
        programId: 'prog-1',
        clientId: 'client-1',
        status: BookingStatus.CONFIRMED,
        price: new Prisma.Decimal(0),
        expiresAt: null,
      },
    });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).resolves.toEqual({
      type: 'ENROLLED',
      bookingId: 'book-existing',
      status: BookingStatus.CONFIRMED,
      invoiceId: null,
    });
    expect(tx.invoice.findUnique).toHaveBeenCalledWith({
      where: { bookingId: 'book-existing' },
      select: { id: true },
    });
  });

  it('uses the booked price when a formerly free confirmed enrollment is resumed', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 1,
      maxParticipants: 10,
      price: new Prisma.Decimal(50000),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.programEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      programId: 'prog-1',
      clientId: 'client-1',
      bookingId: 'book-existing',
      booking: {
        id: 'book-existing',
        programId: 'prog-1',
        clientId: 'client-1',
        status: BookingStatus.CONFIRMED,
        price: new Prisma.Decimal(0),
        expiresAt: null,
      },
    });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).resolves.toEqual({
      type: 'ENROLLED',
      bookingId: 'book-existing',
      status: BookingStatus.CONFIRMED,
      invoiceId: null,
    });
    expect(tx.invoice.findUnique).toHaveBeenCalled();
  });

  it('rejects a paid existing booking with no invoice even when the program is now free', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 1,
      maxParticipants: 10,
      price: new Prisma.Decimal(0),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.programEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      programId: 'prog-1',
      clientId: 'client-1',
      bookingId: 'book-existing',
      booking: {
        id: 'book-existing',
        programId: 'prog-1',
        clientId: 'client-1',
        status: BookingStatus.AWAITING_PAYMENT,
        price: new Prisma.Decimal(50000),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).rejects.toThrow(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('rechecks the duplicate enrollment under the program lock', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 0,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    // The outside snapshot has no enrollment, but the row created by a
    // concurrent request is visible after this call waits on the lock.
    tx.programEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      programId: 'prog-1',
      clientId: 'client-1',
      bookingId: 'book-existing',
      booking: {
        id: 'book-existing',
        programId: 'prog-1',
        clientId: 'client-1',
        status: BookingStatus.AWAITING_PAYMENT,
        price: new Prisma.Decimal(10000),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    tx.invoice.findUnique.mockResolvedValue({ id: 'inv-existing' });

    const result = await handler.execute({ programId: 'prog-1', clientId: 'client-1' });

    expect(result.bookingId).toBe('book-existing');
    expect(tx.programEnrollment.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { programId_clientId: { programId: 'prog-1', clientId: 'client-1' } },
    }));
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.programEnrollment.create).not.toHaveBeenCalled();
  });

  it('rejects an unrelated client when the locked program is full', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 10,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.program.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'different-client' }),
    ).rejects.toThrow(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it.each([
    BookingStatus.CANCELLED,
    BookingStatus.EXPIRED,
    BookingStatus.COMPLETED,
    BookingStatus.NO_SHOW,
  ])('does not resurrect a terminal enrollment (%s)', async (status) => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 1,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.programEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      programId: 'prog-1',
      clientId: 'client-1',
      bookingId: 'book-terminal',
      booking: {
        id: 'book-terminal',
        programId: 'prog-1',
        clientId: 'client-1',
        status,
        price: new Prisma.Decimal(10000),
        expiresAt: null,
      },
    });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).rejects.toThrow(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.program.updateMany).not.toHaveBeenCalled();
  });

  it('does not resume an unpaid enrollment after its booking deadline', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 1,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.programEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      programId: 'prog-1',
      clientId: 'client-1',
      bookingId: 'book-expired',
      booking: {
        id: 'book-expired',
        programId: 'prog-1',
        clientId: 'client-1',
        status: BookingStatus.AWAITING_PAYMENT,
        price: new Prisma.Decimal(10000),
        expiresAt: new Date(Date.now() - 1),
      },
    });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).rejects.toThrow(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('rejects an enrollment whose booking reference is inconsistent', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 1,
      maxParticipants: 10,
      price: new Prisma.Decimal(10000),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.programEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      programId: 'prog-1',
      clientId: 'client-1',
      bookingId: 'book-missing',
      booking: null,
    });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).rejects.toThrow(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('creates a CONFIRMED booking and skips invoice when the program is free', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 0,
      maxParticipants: 10,
      price: new Prisma.Decimal(0),
      currency: 'SAR',
      branchId: 'b-1',
      hoursPerDay: 4,
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    // For a free program we stay OPEN (no min-reached transition)
    tx.program.findUnique.mockImplementation(({ select }: { select?: Record<string, unknown> }) =>
      select?.status
        ? Promise.resolve({ status: ProgramStatus.OPEN, enrolledCount: 0, maxParticipants: 10, minParticipants: 5 })
        : Promise.resolve({ enrolledCount: 1, minParticipants: 5 }));

    const result = await handler.execute({ programId: 'prog-1', clientId: 'client-1' });

    expect(result.type).toBe('ENROLLED');
    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(result.invoiceId).toBeNull();
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingType: 'GROUP',
          deliveryType: DeliveryType.IN_PERSON,
          serviceId: null,
          programId: 'prog-1',
          employeeId: 'emp-1',
          price: 0,
          scheduledAt: PROGRAM_DATE_PLACEHOLDER,
          // Advisory dates must satisfy the Booking CHECK constraints
          // (durationMins > 0, endsAt > scheduledAt) — these were 0 / equal
          // before and silently broke every enrollment against a real DB.
          durationMins: 240,
        }),
      }),
    );
    const createdBooking = tx.booking.create.mock.calls[0][0].data;
    expect(createdBooking.durationMins).toBeGreaterThan(0);
    expect(createdBooking.endsAt.getTime()).toBeGreaterThan(
      createdBooking.scheduledAt.getTime(),
    );
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('creates an AWAITING_PAYMENT booking + invoice and flips status to MIN_REACHED when threshold is crossed', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 3,
      maxParticipants: 10,
      price: new Prisma.Decimal(50000),
      currency: 'SAR',
      branchId: 'b-1',
      nameAr: 'برنامج',
      nameEn: 'Program',
      ref: 7,
      minParticipants: 4,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.program.findUnique.mockImplementation(({ select }: { select?: Record<string, unknown> }) =>
      select?.status
        ? Promise.resolve({ status: ProgramStatus.OPEN, enrolledCount: 3, maxParticipants: 10, minParticipants: 4 })
        : Promise.resolve({ enrolledCount: 4, minParticipants: 4 }));

    const result = await handler.execute({ programId: 'prog-1', clientId: 'client-1' });

    expect(result.type).toBe('ENROLLED');
    expect(result.status).toBe(BookingStatus.AWAITING_PAYMENT);
    expect(result.invoiceId).toBe('inv-1');
    expect(tx.invoice.create).toHaveBeenCalled();
    expect(tx.program.update).toHaveBeenCalledWith({
      where: { id: 'prog-1' },
      data: { status: 'MIN_REACHED' },
    });
    expect(eventBus.publishOptional).toHaveBeenCalledWith(
      'bookings.program.min_reached',
      expect.objectContaining({
        payload: expect.objectContaining({
          programId: 'prog-1',
          programRef: 7,
          minParticipants: 4,
          enrolledCount: 4,
        }),
      }),
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('does NOT flip to MIN_REACHED when threshold is not yet crossed', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
      enrolledCount: 1,
      maxParticipants: 10,
      price: new Prisma.Decimal(50000),
      currency: 'SAR',
      branchId: 'b-1',
      nameAr: 'برنامج',
      nameEn: null,
      ref: 7,
      minParticipants: 5,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    tx.program.findUnique.mockImplementation(({ select }: { select?: Record<string, unknown> }) =>
      select?.status
        ? Promise.resolve({ status: ProgramStatus.OPEN, enrolledCount: 1, maxParticipants: 10, minParticipants: 5 })
        : Promise.resolve({ enrolledCount: 2, minParticipants: 5 }));

    await handler.execute({ programId: 'prog-1', clientId: 'client-1' });

    expect(tx.program.update).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
