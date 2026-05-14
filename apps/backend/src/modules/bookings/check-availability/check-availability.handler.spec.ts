import { CheckAvailabilityHandler } from './check-availability.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

const future = new Date(Date.now() + 86400_000);

describe('CheckAvailabilityHandler', () => {
  const tomorrowMidnight = new Date(future);
  tomorrowMidnight.setHours(0, 0, 0, 0);

  const defaultSettingsHandler = {
    execute: jest.fn().mockResolvedValue({
      bufferMinutes: 0,
      minBookingLeadMinutes: 0,
      maxAdvanceBookingDays: 90,
    }),
  };

  it('returns available slots when employee has a shift covering the day', async () => {
    const result = await new CheckAvailabilityHandler(buildPrisma() as never, defaultSettingsHandler as never).execute({
      employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array when branch is closed', async () => {
    const prisma = buildPrisma();
    prisma.businessHour.findUnique = jest.fn().mockResolvedValue({ isOpen: false });
    const result = await new CheckAvailabilityHandler(prisma as never, defaultSettingsHandler as never).execute({
      employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when employee has no shifts on this day (weekly off)', async () => {
    const prisma = buildPrisma();
    prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([]);
    const result = await new CheckAvailabilityHandler(prisma as never, defaultSettingsHandler as never).execute({
      employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when a holiday exists for the branch on that date', async () => {
    const prisma = buildPrisma();
    prisma.holiday.findFirst = jest.fn().mockResolvedValue({ id: 'hol-1', branchId: 'branch-1', date: tomorrowMidnight });
    const result = await new CheckAvailabilityHandler(prisma as never, defaultSettingsHandler as never).execute({
      employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when an exception covers the requested date', async () => {
    const prisma = buildPrisma();
    const yesterday = new Date(tomorrowMidnight);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayAfter = new Date(tomorrowMidnight);
    dayAfter.setDate(dayAfter.getDate() + 1);
    prisma.employeeAvailabilityException.findFirst = jest.fn().mockResolvedValue({
      id: 'exc-1', employeeId: 'emp-1', startDate: yesterday, endDate: dayAfter,
    });
    const result = await new CheckAvailabilityHandler(prisma as never, defaultSettingsHandler as never).execute({
      employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(result).toEqual([]);
  });

  it('generates slots from both windows for a split shift with no slots in the gap', async () => {
    const prisma = buildPrisma();
    prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
      branchId: 'branch-1', dayOfWeek: tomorrowMidnight.getDay(),
      startTime: '08:00', endTime: '22:00', isOpen: true,
    });
    prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
      { employeeId: 'emp-1', dayOfWeek: tomorrowMidnight.getDay(), startTime: '09:00', endTime: '13:00', isActive: true },
      { employeeId: 'emp-1', dayOfWeek: tomorrowMidnight.getDay(), startTime: '16:00', endTime: '21:00', isActive: true },
    ]);

    const result = await new CheckAvailabilityHandler(prisma as never, defaultSettingsHandler as never).execute({
      employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });

    const hours = result.map((s) => s.startTime.getHours());
    expect(hours.every((h) => (h >= 9 && h < 13) || (h >= 16 && h < 21))).toBe(true);
    expect(hours.some((h) => h >= 13 && h < 16)).toBe(false);
    expect(result.length).toBeGreaterThan(0);
  });

  it('clamps slot window to branch hours when shift exceeds them', async () => {
    const prisma = buildPrisma();
    prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
      branchId: 'branch-1', dayOfWeek: tomorrowMidnight.getDay(),
      startTime: '09:00', endTime: '17:00', isOpen: true,
    });
    prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
      { employeeId: 'emp-1', dayOfWeek: tomorrowMidnight.getDay(), startTime: '08:00', endTime: '18:00', isActive: true },
    ]);

    const result = await new CheckAvailabilityHandler(prisma as never, defaultSettingsHandler as never).execute({
      employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });

    expect(result.every((s) => s.startTime.getHours() >= 9)).toBe(true);
    expect(result.every((s) => s.endTime <= new Date(tomorrowMidnight.getTime() + 17 * 3600_000))).toBe(true);
  });
});

describe('CheckAvailabilityHandler — settings enforcement', () => {
  const makeSettingsHandler = (overrides: Partial<{ bufferMinutes: number; minBookingLeadMinutes: number; maxAdvanceBookingDays: number }> = {}) => ({
    execute: jest.fn().mockResolvedValue({
      bufferMinutes: 0,
      minBookingLeadMinutes: 0,
      maxAdvanceBookingDays: 90,
      ...overrides,
    }),
  });

  it('returns empty array when date exceeds maxAdvanceBookingDays', async () => {
    const prisma = buildPrisma();
    const handler = new CheckAvailabilityHandler(
      prisma as never,
      makeSettingsHandler({ maxAdvanceBookingDays: 7 }) as never,
    );
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
