import { UpsertBookingSettingsHandler } from './upsert-booking-settings.handler';
import { buildPrisma, buildTenant } from '../testing/booking-test-helpers';

const dbSettings = {
  id: 'settings-1', branchId: null,
  bufferMinutes: 0, freeCancelBeforeHours: 24, freeCancelRefundType: 'FULL' as const,
  lateCancelRefundPercent: 0, maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2, autoNoShowAfterMinutes: 30,
  minBookingLeadMinutes: 60, maxAdvanceBookingDays: 90,
  waitlistEnabled: true, waitlistMaxPerSlot: 5,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('UpsertBookingSettingsHandler', () => {
  it('creates settings when none exist for branchId', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ ...dbSettings, branchId: 'branch-1', bufferMinutes: 15 }),
    };
    const handler = new UpsertBookingSettingsHandler(prisma as never, buildTenant() as never);

    const result = await handler.execute({ branchId: 'branch-1', bufferMinutes: 15 });

    expect((prisma as any).bookingSettings.findFirst).toHaveBeenCalledWith({
      where: { branchId: 'branch-1' },
    });
    expect((prisma as any).bookingSettings.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ branchId: 'branch-1', bufferMinutes: 15 }),
    });
    expect((result as typeof dbSettings).bufferMinutes).toBe(15);
  });

  it('updates existing settings when row exists', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findFirst: jest.fn().mockResolvedValue(dbSettings),
      update: jest.fn().mockResolvedValue({ ...dbSettings, bufferMinutes: 5 }),
    };
    const handler = new UpsertBookingSettingsHandler(prisma as never, buildTenant() as never);

    await handler.execute({ branchId: null, bufferMinutes: 5 });

    expect((prisma as any).bookingSettings.update).toHaveBeenCalledWith({
      where: { id: 'settings-1' },
      data: { bufferMinutes: 5 },
    });
  });
});
