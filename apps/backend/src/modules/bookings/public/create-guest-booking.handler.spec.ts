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
  sessionChannel: 'EMAIL' as const,
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
    organizationSettings: { findFirst: jest.fn() },
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
    jest.clearAllMocks();

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

  // ─── Pre-flight validations ───────────────────────────────────────────────

  describe('scheduledAt validations', () => {
    it('should throw BadRequestException for past booking time', async () => {
      await expect(handler.execute({ ...baseCmd(), startsAt: PAST_DATE }))
        .rejects.toThrow(new BadRequestException('Booking must be scheduled in the future'));
    });

    it('should throw BadRequestException when booking exceeds max advance days', async () => {
      const farFuture = new Date(Date.now() + 100 * 86400000).toISOString();
      await expect(handler.execute({ ...baseCmd(), startsAt: farFuture }))
        .rejects.toThrow(new BadRequestException('Booking cannot be scheduled more than 90 days in advance'));
    });

    it('should throw BadRequestException when booking is before min lead time', async () => {
      const tooSoon = new Date(Date.now() + 30 * 60_000).toISOString(); // 30 minutes from now
      await expect(handler.execute({ ...baseCmd(), startsAt: tooSoon }))
        .rejects.toThrow(new BadRequestException('Booking must be scheduled at least 60 minutes in advance'));
    });
  });

  describe('identifier mismatch', () => {
    it('should throw UnauthorizedException when EMAIL identifier does not match client.email', async () => {
      await expect(handler.execute({
        ...baseCmd(),
        sessionChannel: 'EMAIL',
        identifier: 'other@example.com',
      })).rejects.toThrow(new UnauthorizedException('Session identifier does not match booking contact'));
    });

    it('should throw UnauthorizedException when SMS identifier does not match client.phone', async () => {
      await expect(handler.execute({
        ...baseCmd(),
        sessionChannel: 'SMS',
        identifier: '+966500000000',
      })).rejects.toThrow(new UnauthorizedException('Session identifier does not match booking contact'));
    });
  });

  // ─── Branch / Employee / Service lookups ──────────────────────────────────

  describe('branch lookup', () => {
    it('should throw NotFoundException when branch not found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(handler.execute(baseCmd())).rejects.toThrow(new NotFoundException('Branch not found'));
    });
  });

  describe('employee lookup', () => {
    beforeEach(() => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    });

    it('should throw NotFoundException when employee not found', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      await expect(handler.execute(baseCmd())).rejects.toThrow(new NotFoundException('Employee not found'));
    });

    it('should throw BadRequestException when employee is inactive', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: false, isPublic: true });
      await expect(handler.execute(baseCmd())).rejects.toThrow(new BadRequestException('Employee is not active'));
    });

    it('should throw BadRequestException when employee is not public', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: false });
      await expect(handler.execute(baseCmd())).rejects.toThrow(new BadRequestException('Employee is not available for public booking'));
    });
  });

  describe('employee-branch assignment', () => {
    beforeEach(() => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: true });
    });

    it('should throw BadRequestException when employee is not assigned to branch', async () => {
      mockPrisma.employeeBranch.findUnique.mockResolvedValue(null);
      await expect(handler.execute(baseCmd())).rejects.toThrow(new BadRequestException('Employee is not assigned to this branch'));
    });
  });

  describe('service lookup', () => {
    beforeEach(() => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: true });
      mockPrisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
    });

    it('should throw NotFoundException when service not found', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);
      await expect(handler.execute(baseCmd())).rejects.toThrow(new NotFoundException('Service not found'));
    });

    it('should throw BadRequestException when service is inactive', async () => {
      mockPrisma.service.findFirst.mockResolvedValue({ id: 'service-1', isActive: false, isHidden: false });
      await expect(handler.execute(baseCmd())).rejects.toThrow(new BadRequestException('Service is not active'));
    });

    it('should throw BadRequestException when service is hidden', async () => {
      mockPrisma.service.findFirst.mockResolvedValue({ id: 'service-1', isActive: true, isHidden: true });
      await expect(handler.execute(baseCmd())).rejects.toThrow(new BadRequestException('Service is not available for public booking'));
    });
  });

  describe('employee-service assignment', () => {
    beforeEach(() => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: true });
      mockPrisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
      mockPrisma.service.findFirst.mockResolvedValue({ id: 'service-1', isActive: true, isHidden: false });
    });

    it('should throw BadRequestException when employee does not provide the service', async () => {
      mockPrisma.employeeService.findUnique.mockResolvedValue(null);
      await expect(handler.execute(baseCmd())).rejects.toThrow(new BadRequestException('Employee does not provide this service'));
    });
  });

  // ─── Transaction block ────────────────────────────────────────────────────

  describe('transaction', () => {
    beforeEach(() => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true, isPublic: true });
      mockPrisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
      mockPrisma.service.findFirst.mockResolvedValue({ id: 'service-1', isActive: true, isHidden: false });
      mockPrisma.employeeService.findUnique.mockResolvedValue({ id: 'es-1' });
    });

    it('should throw UnauthorizedException when usedOtpSession.create throws P2002', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          ...mockPrisma,
          usedOtpSession: {
            create: jest.fn().mockRejectedValue(
              new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '0.0.0' }),
            ),
          },
          organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
        };
        return fn(txMock);
      });

      await expect(handler.execute(baseCmd())).rejects.toThrow(new UnauthorizedException('OTP session already used'));
    });

    it('should re-throw unknown errors from usedOtpSession.create', async () => {
      const unknownErr = new Error('DB down');
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          ...mockPrisma,
          usedOtpSession: { create: jest.fn().mockRejectedValue(unknownErr) },
          organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
        };
        return fn(txMock);
      });

      await expect(handler.execute(baseCmd())).rejects.toThrow('DB down');
    });

    it('should throw ConflictException when time slot is already taken', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn().mockResolvedValue({ id: 'existing-booking' }),
            create: jest.fn(),
          },
          client: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
          invoice: { create: jest.fn() },
          organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
        };
        return fn(txMock);
      });

      await expect(handler.execute(baseCmd())).rejects.toThrow(new ConflictException('Employee already has a booking in this time slot'));
    });

    it('should create a new client when none exists', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'booking-1', bookingNumber: 42 }),
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

    it('should update existing client instead of creating', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'booking-1', bookingNumber: 42 }),
          },
          client: {
            findFirst: jest.fn().mockResolvedValue({ id: 'client-existing', gender: 'MALE' }),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({ id: 'client-existing' }),
          },
          invoice: { create: jest.fn().mockResolvedValue({ id: 'invoice-1' }) },
          organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
        };
        return fn(txMock);
      });

      const cmd = { ...baseCmd(), client: { ...baseCmd().client, gender: undefined as any } };
      const result = await handler.execute(cmd);

      expect(result).toEqual({ bookingId: 'booking-1', invoiceId: 'invoice-1', totalHalalat: 11500 });
    });

    it('should generate sequential booking numbers', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(null) // conflict check
              .mockResolvedValueOnce({ bookingNumber: 99 }), // last booking number
            create: jest.fn().mockResolvedValue({ id: 'booking-1', bookingNumber: 100 }),
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

      expect(result.bookingId).toBe('booking-1');
    });

    it('should start booking numbers at 1 when no previous bookings exist', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(null) // conflict check
              .mockResolvedValueOnce(null), // no previous bookings
            create: jest.fn().mockResolvedValue({ id: 'booking-1', bookingNumber: 1 }),
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

      expect(result.bookingId).toBe('booking-1');
    });

    it('should calculate VAT correctly and create invoice', async () => {
      mockPriceResolver.resolve.mockResolvedValueOnce({ price: 200, durationMins: 60, currency: 'SAR', durationOptionId: 'do-1' });

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'booking-2', bookingNumber: 7 }),
          },
          client: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'client-2' }),
            update: jest.fn(),
          },
          invoice: { create: jest.fn().mockResolvedValue({ id: 'invoice-2' }) },
          organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.05 }) },
        };
        return fn(txMock);
      });

      const result = await handler.execute(baseCmd());

      // 200 + 5% VAT = 210 → 21000 halalat
      expect(result).toEqual({ bookingId: 'booking-2', invoiceId: 'invoice-2', totalHalalat: 21000 });
    });

    it('should use default VAT rate of 0.15 when org settings are missing', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'booking-3', bookingNumber: 8 }),
          },
          client: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'client-3' }),
            update: jest.fn(),
          },
          invoice: { create: jest.fn().mockResolvedValue({ id: 'invoice-3' }) },
          organizationSettings: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        return fn(txMock);
      });

      const result = await handler.execute(baseCmd());

      // 100 + 15% VAT = 115 → 11500 halalat
      expect(result).toEqual({ bookingId: 'booking-3', invoiceId: 'invoice-3', totalHalalat: 11500 });
    });

    it('should create guest booking successfully with all fields', async () => {
      mockPriceResolver.resolve.mockResolvedValueOnce({ price: 150, durationMins: 45, currency: 'SAR', durationOptionId: 'do-2' });

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'booking-4', bookingNumber: 10 }),
          },
          client: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'client-4' }),
            update: jest.fn(),
          },
          invoice: { create: jest.fn().mockResolvedValue({ id: 'invoice-4' }) },
          organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
        };
        return fn(txMock);
      });

      const cmd = {
        ...baseCmd(),
        identifier: 'ahmed@test.com',
        client: { name: 'أحمد', phone: '+966501234567', email: 'ahmed@test.com', gender: 'MALE' as const, notes: 'First visit' },
      };
      const result = await handler.execute(cmd);

      expect(result).toEqual({ bookingId: 'booking-4', invoiceId: 'invoice-4', totalHalalat: 17250 });
    });

    it('should update existing client preserving gender when cmd.gender is undefined', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          usedOtpSession: { create: jest.fn().mockResolvedValue({}) },
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'booking-5', bookingNumber: 11 }),
          },
          client: {
            findFirst: jest.fn().mockResolvedValue({ id: 'client-5', gender: 'FEMALE' }),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({ id: 'client-5' }),
          },
          invoice: { create: jest.fn().mockResolvedValue({ id: 'invoice-5' }) },
          organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0.15 }) },
        };
        return fn(txMock);
      });

      const cmd = {
        ...baseCmd(),
        client: { name: 'Updated Name', phone: '+966501234567', email: 'test@example.com' },
      };
      const result = await handler.execute(cmd);
      expect(result.bookingId).toBe('booking-5');
    });
  });
});
