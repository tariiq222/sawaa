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
  let eventBus: { publish: jest.Mock };
  let tx: any;

  beforeEach(async () => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue(undefined),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      program: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          enrolledCount: 4,
          minParticipants: 4,
        }),
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
      },
      programEnrollment: {
        create: jest.fn().mockResolvedValue({ id: 'pe-1' }),
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

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

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

  it('rejects duplicate enrollment (same client enrolling twice)', async () => {
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
      supervisors: [{ employeeId: 'emp-1' }],
    });
    prisma.programEnrollment.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      handler.execute({ programId: 'prog-1', clientId: 'client-1' }),
    ).rejects.toThrow(ConflictException);
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
      nameAr: 'x',
      nameEn: null,
      ref: 1,
      supervisors: [{ employeeId: 'emp-1' }],
    });
    // For a free program we stay OPEN (no min-reached transition)
    tx.program.findUnique.mockResolvedValue({
      enrolledCount: 1,
      minParticipants: 5,
    });

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
        }),
      }),
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
    tx.program.findUnique.mockResolvedValue({
      enrolledCount: 4,
      minParticipants: 4,
    });

    const result = await handler.execute({ programId: 'prog-1', clientId: 'client-1' });

    expect(result.type).toBe('ENROLLED');
    expect(result.status).toBe(BookingStatus.AWAITING_PAYMENT);
    expect(result.invoiceId).toBe('inv-1');
    expect(tx.invoice.create).toHaveBeenCalled();
    expect(tx.program.update).toHaveBeenCalledWith({
      where: { id: 'prog-1' },
      data: { status: 'MIN_REACHED' },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
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
    tx.program.findUnique.mockResolvedValue({
      enrolledCount: 2,
      minParticipants: 5,
    });

    await handler.execute({ programId: 'prog-1', clientId: 'client-1' });

    expect(tx.program.update).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
