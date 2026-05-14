import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateGuestBookingHandler, CreateGuestBookingCommand } from './create-guest-booking.handler';
import { PriceResolverService } from '../../org-experience/services/price-resolver.service';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

import { Prisma } from '@prisma/client';

const FUTURE_DATE = new Date(Date.now() + 86400000).toISOString();
const PAST_DATE = new Date(Date.now() - 3600000).toISOString();

const baseCmd = (): CreateGuestBookingCommand => ({
  serviceId: 'service-1',
  employeeId: 'emp-1',
  branchId: 'branch-1',
  startsAt: FUTURE_DATE,
  client: { name: 'Test', phone: '+966501234567', email: 'test@example.com' },
  identifier: 'test@example.com',
  sessionJti: 'jti-abc',
  sessionExp: Math.floor(Date.now() / 1000) + 1800,
  sessionChannel: 'EMAIL',
});

describe('CreateGuestBookingHandler', () => {
  let handler: CreateGuestBookingHandler;

  const mockPrisma = {
    $transaction: jest.fn(),
    branch: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
    service: { findFirst: jest.fn() },
    employeeService: { findUnique: jest.fn() },
    employeeBranch: { findUnique: jest.fn() },
    usedOtpSession: { create: jest.fn() },
    client: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    booking: { create: jest.fn(), findFirst: jest.fn() },
    invoice: { create: jest.fn() },
  };

  const mockPriceResolver = {
    resolve: jest.fn().mockResolvedValue({ price: 100, durationMins: 30, currency: 'SAR', durationOptionId: null }),
  };

  const mockSettingsHandler = {
    execute: jest.fn().mockResolvedValue({
      maxAdvanceBookingDays: 90,
      minBookingLeadMinutes: 60,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateGuestBookingHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PriceResolverService, useValue: mockPriceResolver },
        { provide: GetBookingSettingsHandler, useValue: mockSettingsHandler },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => mockPrisma.$transaction(fn)),
            withBypassTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => mockPrisma.$transaction(fn)),
          },
        },
      ],
    }).compile();

    handler = module.get<CreateGuestBookingHandler>(CreateGuestBookingHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException for past booking time', async () => {
    await expect(handler.execute({ ...baseCmd(), startsAt: PAST_DATE }))
      .rejects.toThrow(BadRequestException);
  });

  it('should throw UnauthorizedException when email identifier does not match client.email', async () => {
    await expect(handler.execute({
      ...baseCmd(),
      sessionChannel: 'EMAIL',
      identifier: 'other@example.com',
    })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when SMS identifier does not match client.phone', async () => {
    await expect(handler.execute({
      ...baseCmd(),
      sessionChannel: 'SMS',
      identifier: '+966500000000',
    })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw NotFoundException when branch not found', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue(null);
    await expect(handler.execute(baseCmd())).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when employee not found', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    mockPrisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute(baseCmd())).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when employee is not assigned to branch', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: true });
    mockPrisma.employeeBranch.findUnique.mockResolvedValue(null);
    await expect(handler.execute(baseCmd())).rejects.toThrow(BadRequestException);
  });

  it('should throw UnauthorizedException on single-use replay (jti already exists)', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: true });
    mockPrisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
    mockPrisma.service.findFirst.mockResolvedValue({ id: 'service-1', isActive: true, isHidden: false });
    mockPrisma.employeeService.findUnique.mockResolvedValue({ id: 'es-1' });

    // Simulate unique constraint error on usedOtpSession.create
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      const txMock = {
        $executeRaw: jest.fn().mockResolvedValue(undefined),
        ...mockPrisma,
        usedOtpSession: { create: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '0.0.0' })) },
        organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
      };
      return fn(txMock);
    });

    await expect(handler.execute(baseCmd())).rejects.toThrow(UnauthorizedException);
  });

  it('should create guest booking successfully', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: true });
    mockPrisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
    mockPrisma.service.findFirst.mockResolvedValue({ id: 'service-1', isActive: true, isHidden: false });
    mockPrisma.employeeService.findUnique.mockResolvedValue({ id: 'es-1' });

    mockPrisma.$transaction.mockImplementation(async (fn) => {
      const txMock = {
        $executeRaw: jest.fn().mockResolvedValue(undefined),
        usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
        booking: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'booking-1' }),
        },
        client: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'client-1' }),
          update: jest.fn(),
        },
        invoice: { create: jest.fn().mockResolvedValue({ id: 'invoice-1' }) },
        organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
      };
      return fn(txMock);
    });

    const result = await handler.execute(baseCmd());

    expect(result).toEqual({ bookingId: 'booking-1', invoiceId: 'invoice-1', totalHalalat: 11500 });
  });

  it('should throw ConflictException when time slot is taken', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: true });
    mockPrisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
    mockPrisma.service.findFirst.mockResolvedValue({ id: 'service-1', isActive: true, isHidden: false });
    mockPrisma.employeeService.findUnique.mockResolvedValue({ id: 'es-1' });

    mockPrisma.$transaction.mockImplementation(async (fn) => {
      const txMock = {
        $executeRaw: jest.fn().mockResolvedValue(undefined),
        usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
        booking: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-booking' }), create: jest.fn() },
        client: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
        invoice: { create: jest.fn() },
        organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
      };
      return fn(txMock);
    });

    await expect(handler.execute(baseCmd())).rejects.toThrow(ConflictException);
  });
});
