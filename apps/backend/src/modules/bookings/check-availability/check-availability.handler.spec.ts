import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CheckAvailabilityHandler } from './check-availability.handler';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { formatToBusinessHHmm } from '../../../common/timezone';

// Returns the hour-of-day in Asia/Riyadh (business TZ), independent of process.env.TZ.
// CI runs in UTC; local dev may run in Riyadh — both should agree on business hours.
const hourInBusinessTz = (d: Date): number => Number(formatToBusinessHHmm(d).slice(0, 2));

const tomorrow = new Date(Date.now() + 86400_000);
const tomorrowMidnight = new Date(tomorrow);
tomorrowMidnight.setHours(0, 0, 0, 0);

const defaultSettings = {
  bufferMinutes: 0,
  minBookingLeadMinutes: 0,
  maxAdvanceBookingDays: 90,
};

const makePrisma = () => {
  const p = {
    serviceDurationOption: { findFirst: jest.fn().mockResolvedValue(null) },
    service: { findFirst: jest.fn().mockResolvedValue(null) },
    // Default: service supports the requested delivery type. Tests that
    // assert "unsupported" must override this to mockResolvedValue(null).
    // findFirst returns null by default (no active config found); tests that
    // need a duration fallback from ServiceBookingConfig override this.
    serviceBookingConfig: {
      findUnique: jest.fn().mockResolvedValue({ useCustomAvailability: false }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    serviceAvailabilityWindow: { findMany: jest.fn().mockResolvedValue([]) },
    businessHour: {
      findUnique: jest.fn().mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrowMidnight.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: true,
      }),
    },
    holiday: { findFirst: jest.fn().mockResolvedValue(null) },
    employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-1', isActive: true }) },
    employeeService: { findUnique: jest.fn().mockResolvedValue({ id: 'es-1', isActive: true }) },
    employeeAvailability: {
      findMany: jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]),
    },
    employeeAvailabilityException: { findFirst: jest.fn().mockResolvedValue(null) },
    employeeBranch: { findUnique: jest.fn().mockResolvedValue({ id: 'eb-1' }) },
    employeeBreak: { findMany: jest.fn().mockResolvedValue([]) },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
  p.$transaction = jest.fn(async (cb: any) => await cb(p));
  return p;
};

const makeSettingsHandler = (overrides: Partial<typeof defaultSettings> = {}) => ({
  execute: jest.fn().mockResolvedValue({ ...defaultSettings, ...overrides }),
});

describe('CheckAvailabilityHandler', () => {
  let handler: CheckAvailabilityHandler;

  describe('execute — date validation', () => {
    it('returns [] when date is beyond maxAdvanceBookingDays', async () => {
      const prisma = makePrisma();
      const settingsHandler = makeSettingsHandler({ maxAdvanceBookingDays: 7 });
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const farFuture = new Date(Date.now() + 30 * 86400_000);
      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: farFuture,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });
  });

  describe('execute — duration resolution', () => {
    it('returns [] when resolved durationMins is 0 and no explicit duration provided', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
      });
      expect(result).toEqual([]);
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalled();
    });

    it('returns [] when explicit durationMins is 0', async () => {
      const prisma = makePrisma();
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 0,
      });
      expect(result).toEqual([]);
    });

    it('resolves duration by durationOptionId', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 90 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        durationOptionId: 'opt-1',
      });
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'opt-1', serviceId: 'svc-1', isActive: true }),
        }),
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(90 * 60_000);
    });

    it('resolves duration by deliveryType scoped default', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 45 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        deliveryType: 'IN_PERSON' as any,
      });
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: 'svc-1',
            deliveryType: 'IN_PERSON',
            isDefault: true,
            isActive: true,
          }),
        }),
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(45 * 60_000);
    });

    it('falls back to first active option when no deliveryType default exists', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ durationMins: 60 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        bookingType: 'INDIVIDUAL' as any,
      });
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledTimes(2);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(60 * 60_000);
    });

    it('falls back to first active option when no global default exists', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ durationMins: 30 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
      });
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledTimes(2);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(30 * 60_000);
    });

    it('uses explicit durationMins when no serviceId is provided', async () => {
      const prisma = makePrisma();
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 120,
      });
      expect(prisma.serviceDurationOption.findFirst).not.toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(120 * 60_000);
    });
  });

  describe('execute — business hour & holiday guards', () => {
    it('returns [] when businessHour is missing', async () => {
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue(null);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });

    it('returns [] when businessHour.isOpen is false', async () => {
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrowMidnight.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: false,
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });

    it('returns [] when a holiday exists for the branch on that date', async () => {
      const prisma = makePrisma();
      prisma.holiday.findFirst = jest.fn().mockResolvedValue({
        id: 'hol-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });

    it('returns [] when employee has no shifts (shifts.length === 0)', async () => {
      const prisma = makePrisma();
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });
  });

  describe('execute — service custom availability', () => {
    it('intersects branch, service, employee, and break windows', async () => {
      const prisma = makePrisma();
      prisma.serviceBookingConfig.findUnique = jest.fn().mockResolvedValue({ useCustomAvailability: true });
      prisma.serviceAvailabilityWindow.findMany = jest.fn().mockResolvedValue([
        {
          serviceId: 'svc-1',
          deliveryType: 'IN_PERSON',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '10:00',
          endTime: '12:00',
          isActive: true,
        },
      ]);
      prisma.employeeBreak.findMany = jest.fn().mockResolvedValue([
        { employeeId: 'emp-1', dayOfWeek: tomorrowMidnight.getDay(), startTime: '10:30', endTime: '11:00' },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 30,
        deliveryType: 'IN_PERSON' as any,
      });

      expect(result.map((slot) => hourInBusinessTz(slot.startTime))).toEqual([10, 11, 11]);
      expect(result.map((slot) => slot.startTime.getMinutes())).toEqual([0, 0, 30]);
    });

    it('returns [] when useCustomAvailability=true but no availability windows are configured', async () => {
      const prisma = makePrisma();
      prisma.serviceBookingConfig.findUnique = jest
        .fn()
        .mockResolvedValue({ useCustomAvailability: true });
      prisma.serviceAvailabilityWindow.findMany = jest.fn().mockResolvedValue([]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
        deliveryType: 'IN_PERSON' as any,
      });

      expect(result).toEqual([]);
    });

    it('returns [] when useCustomAvailability=true but windows are only for other days', async () => {
      const prisma = makePrisma();
      // Pick a different day of week than tomorrow's so the window filter excludes everything.
      const otherDayOfWeek = (tomorrowMidnight.getDay() + 1) % 7;
      prisma.serviceBookingConfig.findUnique = jest
        .fn()
        .mockResolvedValue({ useCustomAvailability: true });
      prisma.serviceAvailabilityWindow.findMany = jest.fn().mockResolvedValue([
        {
          serviceId: 'svc-1',
          deliveryType: 'IN_PERSON',
          dayOfWeek: otherDayOfWeek,
          startTime: '10:00',
          endTime: '12:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
        deliveryType: 'IN_PERSON' as any,
      });

      expect(result).toEqual([]);
    });

    it('uses full branch hours when useCustomAvailability=false even if no windows exist', async () => {
      const prisma = makePrisma();
      prisma.serviceBookingConfig.findUnique = jest
        .fn()
        .mockResolvedValue({ useCustomAvailability: false });
      prisma.serviceAvailabilityWindow.findMany = jest.fn().mockResolvedValue([]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
        deliveryType: 'IN_PERSON' as any,
      });

      expect(result.length).toBeGreaterThan(0);
      // Branch hours are 09:00-17:00 — confirm we're using them.
      expect(result.every((s) => hourInBusinessTz(s.startTime) >= 9)).toBe(true);
      expect(result.every((s) => hourInBusinessTz(s.endTime) <= 17)).toBe(true);
    });
  });

  describe('execute — missing ServiceBookingConfig gate', () => {
    const buildHandler = async (prisma: ReturnType<typeof makePrisma>) => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: makeSettingsHandler() },
        ],
      }).compile();
      return moduleRef.get(CheckAvailabilityHandler);
    };

    it('throws BadRequestException when the service has no config for the requested deliveryType', async () => {
      const prisma = makePrisma();
      prisma.serviceBookingConfig.findUnique = jest.fn().mockResolvedValue(null);
      handler = await buildHandler(prisma);

      await expect(
        handler.execute({
          employeeId: 'emp-1',
          branchId: 'branch-1',
          serviceId: 'svc-1',
          date: tomorrowMidnight,
          durationMins: 60,
          deliveryType: 'ONLINE' as any,
        }),
      ).rejects.toThrow(
        new BadRequestException('Service does not support the requested delivery type'),
      );
    });

    it('returns [] instead of throwing when silentOnMissingConfig=true', async () => {
      const prisma = makePrisma();
      prisma.serviceBookingConfig.findUnique = jest.fn().mockResolvedValue(null);
      handler = await buildHandler(prisma);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
        deliveryType: 'ONLINE' as any,
        silentOnMissingConfig: true,
      });

      expect(result).toEqual([]);
    });

    it('does not throw when no serviceId is provided even without config rows', async () => {
      const prisma = makePrisma();
      prisma.serviceBookingConfig.findUnique = jest.fn().mockResolvedValue(null);
      handler = await buildHandler(prisma);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(prisma.serviceBookingConfig.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('execute — exception handling', () => {
    it('returns [] when exception covers date and it is NOT the last day', async () => {
      const prisma = makePrisma();
      const yesterday = new Date(tomorrowMidnight);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayAfter = new Date(tomorrowMidnight);
      dayAfter.setDate(dayAfter.getDate() + 1);
      prisma.employeeAvailabilityException.findFirst = jest.fn().mockResolvedValue({
        id: 'exc-1',
        employeeId: 'emp-1',
        startDate: yesterday,
        endDate: dayAfter,
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });

    it('returns [] when exception ends on requested date but endTime is NOT set', async () => {
      const prisma = makePrisma();
      prisma.employeeAvailabilityException.findFirst = jest.fn().mockResolvedValue({
        id: 'exc-1',
        employeeId: 'emp-1',
        startDate: tomorrowMidnight,
        endDate: tomorrowMidnight,
        endTime: null,
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });

    it('allows slots after exceptionCutoff when exception ends on requested date WITH endTime', async () => {
      const prisma = makePrisma();
      prisma.employeeAvailabilityException.findFirst = jest.fn().mockResolvedValue({
        id: 'exc-1',
        employeeId: 'emp-1',
        startDate: tomorrowMidnight,
        endDate: tomorrowMidnight,
        endTime: new Date(tomorrowMidnight.getTime() + 12 * 3600_000),
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result.length).toBeGreaterThan(0);
      expect(hourInBusinessTz(result[0].startTime)).toBeGreaterThanOrEqual(12);
    });
  });

  describe('execute — shift-window intersection', () => {
    it('returns [] when shift does not intersect with branch window at all', async () => {
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrowMidnight.getDay(),
        startTime: '09:00',
        endTime: '12:00',
        isOpen: true,
      });
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '14:00',
          endTime: '18:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });

    it('clamps slot window to branch hours when shift exceeds them', async () => {
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrowMidnight.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: true,
      });
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '08:00',
          endTime: '18:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result.every((s) => hourInBusinessTz(s.startTime) >= 9)).toBe(true);
      expect(result.every((s) => hourInBusinessTz(s.endTime) <= 17)).toBe(true);
    });

    it('handles exact edge case where shift ends exactly at branch start', async () => {
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrowMidnight.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: true,
      });
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '07:00',
          endTime: '09:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });
  });

  describe('execute — exceptionCutoff interactions', () => {
    it('removes window fully before exceptionCutoff', async () => {
      const prisma = makePrisma();
      prisma.employeeAvailabilityException.findFirst = jest.fn().mockResolvedValue({
        id: 'exc-1',
        employeeId: 'emp-1',
        startDate: tomorrowMidnight,
        endDate: tomorrowMidnight,
        endTime: new Date(tomorrowMidnight.getTime() + 14 * 3600_000),
      });
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '09:00',
          endTime: '13:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result).toEqual([]);
    });

    it('trims window partially before exceptionCutoff', async () => {
      const prisma = makePrisma();
      prisma.employeeAvailabilityException.findFirst = jest.fn().mockResolvedValue({
        id: 'exc-1',
        employeeId: 'emp-1',
        startDate: tomorrowMidnight,
        endDate: tomorrowMidnight,
        endTime: new Date(tomorrowMidnight.getTime() + 12 * 3600_000),
      });
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result.length).toBeGreaterThan(0);
      expect(hourInBusinessTz(result[0].startTime)).toBe(12);
    });

    it('keeps window unchanged when entirely after exceptionCutoff', async () => {
      const prisma = makePrisma();
      prisma.employeeAvailabilityException.findFirst = jest.fn().mockResolvedValue({
        id: 'exc-1',
        employeeId: 'emp-1',
        startDate: tomorrowMidnight,
        endDate: tomorrowMidnight,
        endTime: new Date(tomorrowMidnight.getTime() + 8 * 3600_000),
      });
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result.length).toBeGreaterThan(0);
      expect(hourInBusinessTz(result[0].startTime)).toBe(9);
    });
  });

  describe('execute — existing bookings & buffer', () => {
    it('excludes slots that conflict with existing bookings including buffer', async () => {
      const prisma = makePrisma();
      const slotStart = new Date(tomorrowMidnight.getTime() + 10 * 3600_000);
      prisma.booking.findMany = jest.fn().mockResolvedValue([
        {
          id: 'book-1',
          employeeId: 'emp-1',
          status: 'CONFIRMED',
          scheduledAt: slotStart,
          durationMins: 60,
        },
      ]);
      const settingsHandler = makeSettingsHandler({ bufferMinutes: 15 });
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      const tenAMSlots = result.filter(
        (s) => hourInBusinessTz(s.startTime) === 10,
      );
      expect(tenAMSlots.length).toBe(0);
    });

    it('includes slots that do not conflict with existing bookings', async () => {
      const prisma = makePrisma();
      prisma.booking.findMany = jest.fn().mockResolvedValue([
        {
          id: 'book-1',
          employeeId: 'emp-1',
          status: 'CONFIRMED',
          scheduledAt: new Date(tomorrowMidnight.getTime() + 10 * 3600_000),
          durationMins: 60,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      const nineAMSlots = result.filter(
        (s) => hourInBusinessTz(s.startTime) === 9,
      );
      expect(nineAMSlots.length).toBeGreaterThan(0);
    });

    it('counts overlapping bookings that started before the search window', async () => {
      // Booking 8:30-9:30 should block the 9:00-10:00 slot but NOT the 9:30-10:30 slot.
      const prisma = makePrisma();
      const bookingStart = new Date(tomorrowMidnight.getTime() + 8 * 3600_000 + 30 * 60_000);
      prisma.booking.findMany = jest.fn().mockResolvedValue([
        {
          id: 'book-1',
          employeeId: 'emp-1',
          status: 'CONFIRMED',
          scheduledAt: bookingStart,
          durationMins: 60,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      // 9:00 slot conflicts with booking 8:30-9:30 — must NOT appear
      const nineOclockSlots = result.filter(
        (s) => hourInBusinessTz(s.startTime) === 9 && s.startTime.getMinutes() === 0,
      );
      expect(nineOclockSlots.length).toBe(0);
      // 9:30 slot starts exactly when booking ends — allowed
      const nineThirtySlots = result.filter(
        (s) => hourInBusinessTz(s.startTime) === 9 && s.startTime.getMinutes() === 30,
      );
      expect(nineThirtySlots.length).toBe(1);
    });

    it('filters out slots before earliestAllowed due to minBookingLeadMinutes', async () => {
      const prisma = makePrisma();
      const settingsHandler = makeSettingsHandler({
        minBookingLeadMinutes: 10080,
      });
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(result.length).toBe(0);
    });
  });

  describe('execute — multiple shift windows with gaps', () => {
    it('generates slots from both windows for a split shift with no slots in the gap', async () => {
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrowMidnight.getDay(),
        startTime: '08:00',
        endTime: '22:00',
        isOpen: true,
      });
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '09:00',
          endTime: '13:00',
          isActive: true,
        },
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '16:00',
          endTime: '21:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      const hours = result.map((s) => hourInBusinessTz(s.startTime));
      expect(hours.every((h) => (h >= 9 && h < 13) || (h >= 16 && h < 21))).toBe(true);
      expect(hours.some((h) => h >= 13 && h < 16)).toBe(false);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('execute — happy path', () => {
    it('returns available slots when employee has a shift covering the day', async () => {
      const prisma = makePrisma();
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('resolveDurationOption — direct coverage', () => {
    it('resolves by durationOptionId', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 90 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await (handler as any).resolveDurationOption('svc-1', 'opt-1', null);
      expect(result).toEqual({ durationMins: 90 });
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'opt-1', serviceId: 'svc-1', isActive: true }),
        }),
      );
    });

    it('resolves by deliveryType scoped default', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 45 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await (handler as any).resolveDurationOption('svc-1', null, null, 'IN_PERSON');
      expect(result).toEqual({ durationMins: 45 });
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: 'svc-1',
            deliveryType: 'IN_PERSON',
            isDefault: true,
            isActive: true,
          }),
        }),
      );
    });

    it('falls back to global default when scoped default is missing', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ durationMins: 60 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await (handler as any).resolveDurationOption('svc-1', null, 'INDIVIDUAL');
      expect(result).toEqual({ durationMins: 60 });
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledTimes(2);
    });

    it('falls back to first active option when no global default exists', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ durationMins: 30 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await (handler as any).resolveDurationOption('svc-1', null, null);
      expect(result).toEqual({ durationMins: 30 });
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Effective-duration precedence (P0 regression — employee override) ───

  describe('execute — explicit durationMins takes precedence over option lookup', () => {
    it('uses the explicit durationMins passed by the caller and skips option lookup', async () => {
      const prisma = makePrisma();
      // If the bug returns, the option (45) would overwrite the caller's 60.
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 45 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        durationOptionId: 'opt-45',
        durationMins: 60,
      });

      // Option lookup must NOT be invoked when a positive durationMins is supplied.
      expect(prisma.serviceDurationOption.findFirst).not.toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      // Every slot must reflect the explicit 60-minute duration (not 45).
      expect(result.every((s) => s.endTime.getTime() - s.startTime.getTime() === 60 * 60_000)).toBe(true);
    });

    it('falls back to option lookup when durationMins is missing', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 45 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        durationOptionId: 'opt-45',
      });

      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(45 * 60_000);
    });

    it('regression: 60-min check detects conflict with an existing 45-min booking at 9:00', async () => {
      // Existing booking: 9:00 → 9:45 (45 min).
      // If the bug were still present, asking for a 60-min slot at 9:00 but
      // with durationOptionId='opt-45' would shrink the requested duration
      // back to 45 min and incorrectly mark 9:00 as available (because the
      // existing booking ends exactly when the shrunken slot does).
      // With the fix, the 60-min slot at 9:00 overlaps 9:00-9:45 → conflict.
      const prisma = makePrisma();
      const bookingStart = new Date(tomorrowMidnight.getTime() + 9 * 3600_000);
      prisma.booking.findMany = jest.fn().mockResolvedValue([
        {
          id: 'book-existing-45',
          employeeId: 'emp-1',
          status: 'CONFIRMED',
          scheduledAt: bookingStart,
          durationMins: 45,
        },
      ]);
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 45 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        durationOptionId: 'opt-45',
        // Caller (create-booking) passes effective duration 60 (employee override).
        durationMins: 60,
      });

      // 9:00 slot would be 9:00→10:00, overlapping the existing 9:00→9:45 booking.
      const nineSlots = result.filter(
        (s) => hourInBusinessTz(s.startTime) === 9 && s.startTime.getMinutes() === 0,
      );
      expect(nineSlots.length).toBe(0);
    });
  });

  // ─── DeliveryType-aware availability (TDD — refactor-booking-delivery-type) ───

  describe('execute — deliveryType-aware duration resolution', () => {
    it('uses deliveryType for duration calculation when provided', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 90 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        deliveryType: 'ONLINE' as any,
      });

      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: 'svc-1',
            deliveryType: 'ONLINE',
            isDefault: true,
            isActive: true,
          }),
        }),
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(90 * 60_000);
    });

    it('rejects slots for unsupported delivery type', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
      prisma.service.findFirst = jest.fn().mockResolvedValue({
        id: 'svc-1',
        bufferMinutes: 0,
        minLeadMinutes: 0,
        maxAdvanceDays: 90,
        bookingConfigs: [{ bookingType: 'IN_PERSON' }],
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        deliveryType: 'ONLINE' as any,
      });

      expect(result).toEqual([]);
    });

    it('falls back to service default when deliveryType is omitted', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ durationMins: 60 });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        serviceId: 'svc-1',
        bookingType: 'INDIVIDUAL' as any,
      });

      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: 'svc-1',
            isDefault: true,
            isActive: true,
          }),
        }),
      );
    });
  });

  // ─── Track B — practitioner ↔ service ↔ availability integrity ─────────────
  // These tests document the integrity contract for the practitioner
  // surface: an inactive employee must never produce slots, a soft-disabled
  // employee↔service link must never produce slots, PENDING / AWAITING_PAYMENT
  // bookings must block the slot, and a date outside business hours must
  // never produce a slot even if a shift row exists for that day.

  describe('execute — Track B: employee active filter', () => {
    it('returns [] when the employee exists but isActive is false', async () => {
      const prisma = makePrisma();
      // Simulate the Employee.isActive=false lookup — the handler must read
      // this and short-circuit before querying employeeAvailability.
      prisma.employee.findFirst = jest.fn().mockResolvedValue({ id: 'emp-1', isActive: false });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result).toEqual([]);
    });

    it('returns [] when the employee is not found', async () => {
      const prisma = makePrisma();
      prisma.employee.findFirst = jest.fn().mockResolvedValue(null);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'missing-emp',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result).toEqual([]);
    });
  });

  describe('execute — Track B: employeeService.isActive filter (specialty match)', () => {
    it('returns [] when employee is not linked to the requested service at all', async () => {
      const prisma = makePrisma();
      prisma.employeeService = {
        findUnique: jest.fn().mockResolvedValue(null),
      };
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result).toEqual([]);
    });

    it('returns [] when the employee→service link is soft-disabled (isActive=false)', async () => {
      const prisma = makePrisma();
      prisma.employeeService = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'es-1',
          employeeId: 'emp-1',
          serviceId: 'svc-1',
          isActive: false,
        }),
      };
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result).toEqual([]);
    });

    it('returns slots when the link is active (regression baseline)', async () => {
      const prisma = makePrisma();
      prisma.employeeService = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'es-1',
          employeeId: 'emp-1',
          serviceId: 'svc-1',
          isActive: true,
        }),
      };
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('returns [] when the practitioner opted out of the requested deliveryType', async () => {
      const prisma = makePrisma();
      prisma.employeeService = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'es-1',
          employeeId: 'emp-1',
          serviceId: 'svc-1',
          isActive: true,
          disabledDeliveryTypes: ['IN_PERSON'],
        }),
      };
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const blocked = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
        deliveryType: 'IN_PERSON' as never,
      });
      expect(blocked).toEqual([]);

      // A type the practitioner still offers must keep producing slots.
      const allowed = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
        deliveryType: 'ONLINE' as never,
      });
      expect(allowed.length).toBeGreaterThan(0);
    });
  });

  describe('execute — Track B: overlap detection across all blocking statuses', () => {
    const blockingStatuses: Array<{ status: string; label: string }> = [
      { status: 'PENDING', label: 'PENDING booking' },
      { status: 'CONFIRMED', label: 'CONFIRMED booking' },
      { status: 'AWAITING_PAYMENT', label: 'AWAITING_PAYMENT booking' },
      { status: 'DEPOSIT_PAID', label: 'DEPOSIT_PAID booking' },
      { status: 'CANCEL_REQUESTED', label: 'CANCEL_REQUESTED booking' },
    ];

    it.each(blockingStatuses)(
      'excludes the conflicting slot for a $label at 10:00',
      async ({ status }) => {
        const prisma = makePrisma();
        const slotStart = new Date(tomorrowMidnight.getTime() + 10 * 3600_000);
        prisma.booking.findMany = jest.fn().mockResolvedValue([
          {
            id: 'book-1',
            employeeId: 'emp-1',
            status,
            scheduledAt: slotStart,
            durationMins: 60,
          },
        ]);
        const settingsHandler = makeSettingsHandler();
        const moduleRef = await Test.createTestingModule({
          providers: [
            CheckAvailabilityHandler,
            { provide: PrismaService, useValue: prisma },
            { provide: GetBookingSettingsHandler, useValue: settingsHandler },
          ],
        }).compile();
        handler = moduleRef.get(CheckAvailabilityHandler);

        const result = await handler.execute({
          employeeId: 'emp-1',
          branchId: 'branch-1',
          date: tomorrowMidnight,
          durationMins: 60,
        });

        const tenAMSlots = result.filter(
          (s) => hourInBusinessTz(s.startTime) === 10 && s.startTime.getMinutes() === 0,
        );
        expect(tenAMSlots.length).toBe(0);
        // Sanity: the 9:00 slot is still offered.
        const nineAMSlots = result.filter(
          (s) => hourInBusinessTz(s.startTime) === 9 && s.startTime.getMinutes() === 0,
        );
        expect(nineAMSlots.length).toBeGreaterThan(0);
      },
    );

    it('queries existing bookings with the blocking-status filter (PENDING/CONFIRMED/etc)', async () => {
      // Defensive: the handler's conflict query must scope to
      // STAFF_TIME_BLOCKING_BOOKING_STATUSES so CANCELLED / COMPLETED /
      // EXPIRED terminal bookings do not block slots. Mock findMany with no
      // rows; assert the handler called it with the right WHERE shape.
      const prisma = makePrisma();
      prisma.booking.findMany = jest.fn().mockResolvedValue([]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-1',
            status: expect.objectContaining({ in: expect.any(Array) }),
          }),
        }),
      );
    });
  });

  describe('execute — Track B: business-hours rejection', () => {
    it('returns [] when no businessHour row exists for the requested day', async () => {
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue(null);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result).toEqual([]);
    });

    it('returns [] when the businessHour row exists but isOpen=false', async () => {
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrowMidnight.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: false,
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result).toEqual([]);
    });

    it('returns [] when a holiday row exists for the branch on that date', async () => {
      const prisma = makePrisma();
      prisma.holiday.findFirst = jest.fn().mockResolvedValue({
        id: 'hol-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result).toEqual([]);
    });

    it('returns [] when the branch is not configured for the day (no businessHour row) even if shifts exist', async () => {
      // Defensive: the handler's branch-window is the intersection anchor. If
      // businessHour is missing, the intersection is undefined → no slots.
      const prisma = makePrisma();
      prisma.businessHour.findUnique = jest.fn().mockResolvedValue(null);
      // Shifts exist for the day but the branch itself is closed.
      prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrowMidnight.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]);
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: tomorrowMidnight,
        durationMins: 60,
      });

      expect(result).toEqual([]);
    });
  });

  describe('execute — duration resolution from ServiceBookingConfig (direct-clinic fix)', () => {
    it('resolves durationMins from ServiceBookingConfig when no ServiceDurationOption exists', async () => {
      const prisma = makePrisma();
      // No ServiceDurationOption rows (direct-clinic hidden service)
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
      // No Service.durationMins (or 0)
      prisma.service.findFirst = jest.fn().mockResolvedValue({ id: 'svc-hidden', durationMins: 0, isActive: true, bufferMinutes: 0, minLeadMinutes: 0, maxAdvanceDays: null });
      // ServiceBookingConfig has durationMins=30, isActive=true
      prisma.serviceBookingConfig.findUnique = jest.fn().mockResolvedValue({
        useCustomAvailability: false,
        durationMins: 30,
        isActive: true,
      });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-hidden',
        date: tomorrowMidnight,
        deliveryType: 'IN_PERSON' as any,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(30 * 60_000);
    });

    it('resolves durationMins from ServiceBookingConfig when no deliveryType provided and no options exist', async () => {
      const prisma = makePrisma();
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
      prisma.service.findFirst = jest.fn().mockResolvedValue({ id: 'svc-hidden', durationMins: 0, isActive: true, bufferMinutes: 0, minLeadMinutes: 0, maxAdvanceDays: null });
      prisma.serviceBookingConfig.findUnique = jest.fn().mockResolvedValue({
        useCustomAvailability: false,
        durationMins: 30,
        isActive: true,
      });
      // findFirst for "any active config" — return the same
      prisma.serviceBookingConfig.findFirst = jest.fn().mockResolvedValue({ durationMins: 30, isActive: true });
      const settingsHandler = makeSettingsHandler();
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        ],
      }).compile();
      handler = moduleRef.get(CheckAvailabilityHandler);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-hidden',
        date: tomorrowMidnight,
        // No deliveryType — falls through to findFirst
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime.getTime() - result[0].startTime.getTime()).toBe(30 * 60_000);
    });
  });

  describe('execute — useCustomPricing gate', () => {
    const buildHandler = async (prisma: ReturnType<typeof makePrisma>) => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          CheckAvailabilityHandler,
          { provide: PrismaService, useValue: prisma },
          { provide: GetBookingSettingsHandler, useValue: makeSettingsHandler() },
        ],
      }).compile();
      return moduleRef.get(CheckAvailabilityHandler);
    };

    it('returns [] when useCustomPricing=true and no owned duration options exist for the delivery type', async () => {
      const prisma = makePrisma();
      prisma.employeeService.findUnique = jest.fn().mockResolvedValue({
        id: 'es-1',
        isActive: true,
        disabledDeliveryTypes: [],
        useCustomPricing: true,
      });
      // findFirst for owned serviceDurationOption returns null → no owned rows
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
      handler = await buildHandler(prisma);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
        deliveryType: 'IN_PERSON' as any,
      });

      expect(result).toEqual([]);
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: 'svc-1',
            deliveryType: 'IN_PERSON',
            employeeServiceId: 'es-1',
            isActive: true,
          }),
        }),
      );
    });

    it('continues to produce slots when useCustomPricing=true and owned options exist', async () => {
      const prisma = makePrisma();
      prisma.employeeService.findUnique = jest.fn().mockResolvedValue({
        id: 'es-1',
        isActive: true,
        disabledDeliveryTypes: [],
        useCustomPricing: true,
      });
      // findFirst for owned serviceDurationOption returns a row → gate passes
      prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({ id: 'opt-owned' });
      handler = await buildHandler(prisma);

      const result = await handler.execute({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: tomorrowMidnight,
        durationMins: 60,
        deliveryType: 'IN_PERSON' as any,
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });
});
