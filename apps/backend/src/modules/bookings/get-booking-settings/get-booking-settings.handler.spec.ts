import { GetBookingSettingsHandler } from './get-booking-settings.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

const dbSettings = {
  id: 'settings-1', branchId: null,
  bufferMinutes: 0, freeCancelBeforeHours: 24, freeCancelRefundType: 'FULL' as const,
  lateCancelRefundPercent: 0, maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2, autoNoShowAfterMinutes: 30,
  minBookingLeadMinutes: 60, maxAdvanceBookingDays: 90,
  waitlistEnabled: true, waitlistMaxPerSlot: 5,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('GetBookingSettingsHandler', () => {
  it('returns branch-level settings when they exist', async () => {
    const branchSettings = { ...dbSettings, id: 'settings-branch', branchId: 'branch-1', bufferMinutes: 10 };
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findFirst: jest.fn().mockResolvedValueOnce(branchSettings),
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ branchId: 'branch-1' });

    expect((result as typeof branchSettings).bufferMinutes).toBe(10);
    expect((prisma as any).bookingSettings.findFirst).toHaveBeenCalledTimes(1);
  });

  it('falls back to global settings when no branch-level row exists', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findFirst: jest.fn()
        .mockResolvedValueOnce(null)      // branch lookup returns null
        .mockResolvedValueOnce(dbSettings), // global lookup returns settings
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ branchId: 'branch-1' });

    expect((result as typeof dbSettings).bufferMinutes).toBe(0);
    expect((prisma as any).bookingSettings.findFirst).toHaveBeenCalledTimes(2);
  });

  it('returns hardcoded defaults when no DB row exists', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findFirst: jest.fn().mockResolvedValue(null),
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ branchId: 'branch-1' });

    expect(result.bufferMinutes).toBe(0);
    expect(result.freeCancelBeforeHours).toBe(24);
    expect(result.maxReschedulesPerBooking).toBe(3);
  });
});
