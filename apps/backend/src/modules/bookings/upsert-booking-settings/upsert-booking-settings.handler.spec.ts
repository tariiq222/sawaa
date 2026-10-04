import { UpsertBookingSettingsHandler } from './upsert-booking-settings.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

/** Pass-through CacheService mock: no Redis I/O in unit tests. */
const buildCache = () => ({
  getOrSet: jest.fn((_key: string, loader: () => Promise<unknown>) => loader()),
  invalidatePrefix: jest.fn().mockResolvedValue(undefined),
});

const dbSettings = {
  id: 'settings-1', branchId: null,
  bufferMinutes: 0, freeCancelBeforeHours: 24, freeCancelRefundType: 'FULL' as const,
  lateCancelRefundPercent: 0, maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2, autoNoShowAfterMinutes: 30,
  autoNoShowAfterEnd: true,
  minBookingLeadMinutes: 60, maxAdvanceBookingDays: 90,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('UpsertBookingSettingsHandler', () => {
  it('creates settings when none exist for branchId', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ ...dbSettings, branchId: 'branch-1', bufferMinutes: 15 }),
    };
    const handler = new UpsertBookingSettingsHandler(prisma as never, buildCache() as never);

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
    const handler = new UpsertBookingSettingsHandler(prisma as never, buildCache() as never);

    await handler.execute({ branchId: null, bufferMinutes: 5 });

    expect((prisma as any).bookingSettings.update).toHaveBeenCalledWith({
      where: { id: 'settings-1' },
      data: { bufferMinutes: 5 },
    });
  });

  it('persists autoNoShowAfterEnd on update', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findFirst: jest.fn().mockResolvedValue(dbSettings),
      update: jest.fn().mockResolvedValue({ ...dbSettings, autoNoShowAfterEnd: false }),
    };
    const handler = new UpsertBookingSettingsHandler(prisma as never, buildCache() as never);

    await handler.execute({ branchId: null, autoNoShowAfterEnd: false });

    expect((prisma as any).bookingSettings.update).toHaveBeenCalledWith({
      where: { id: 'settings-1' },
      data: { autoNoShowAfterEnd: false },
    });
  });
});

describe('independent client cancellation configuration', () => {
  const configured = {
    ...dbSettings, clientCancellationPolicyEnabled: true,
    clientCancelCutoffMode: 'BEFORE_START', clientCancelBeforeHours: 0,
    freeCancelRefundType: 'PARTIAL', earlyCancelRefundPercent: 80,
    lateCancelRefundPercent: 20, requireCancelApproval: true, autoRefundOnCancel: false,
  };
  function setup(existing: unknown = dbSettings) {
    const prisma = { bookingSettings: {
      findFirst: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue({}),
    } };
    return { prisma, handler: new UpsertBookingSettingsHandler(prisma as never, buildCache() as never) };
  }
  it.each([
    { clientCancellationPolicyEnabled: true },
    { clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_START' },
    { clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_CHECK_IN', freeCancelRefundType: 'PARTIAL' },
  ])('rejects incomplete activation %j without writing', async (patch) => {
    const { handler, prisma } = setup();
    await expect(handler.execute({ branchId: null, ...patch } as never)).rejects.toThrow();
    expect(prisma.bookingSettings.update).not.toHaveBeenCalled();
  });
  it('retains zero cutoff and independent percentages when activating', async () => {
    const { handler, prisma } = setup();
    const patch = { clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_START', clientCancelBeforeHours: 0, freeCancelRefundType: 'PARTIAL', earlyCancelRefundPercent: 80, lateCancelRefundPercent: 20 };
    await handler.execute({ branchId: null, ...patch } as never);
    expect(prisma.bookingSettings.update).toHaveBeenCalledWith({ where: { id: dbSettings.id }, data: patch });
  });
  it('validates merged settings on a partial PATCH without rewriting existing values', async () => {
    const { handler, prisma } = setup(configured);
    await handler.execute({ branchId: null, bufferMinutes: 5 });
    expect(prisma.bookingSettings.update).toHaveBeenCalledWith({ where: { id: dbSettings.id }, data: { bufferMinutes: 5 } });
  });
  it('rejects clearing an enabled cutoff and a missing early percentage', async () => {
    const { handler } = setup(configured);
    await expect(handler.execute({ branchId: null, clientCancelBeforeHours: null } as never)).rejects.toThrow();
    await expect(handler.execute({ branchId: null, earlyCancelRefundPercent: null } as never)).rejects.toThrow();
  });
  it('allows attendance cutoff without hours but requires hours after switching back', async () => {
    const { handler, prisma } = setup({ ...configured, clientCancelCutoffMode: 'BEFORE_CHECK_IN', clientCancelBeforeHours: null });
    await handler.execute({ branchId: null, earlyCancelRefundPercent: 0 } as never);
    expect(prisma.bookingSettings.update).toHaveBeenCalled();
    await expect(handler.execute({ branchId: null, clientCancelCutoffMode: 'BEFORE_START' } as never)).rejects.toThrow();
  });
  it('keeps disabled legacy partial-refund configuration valid', async () => {
    const { handler, prisma } = setup({ ...dbSettings, freeCancelRefundType: 'PARTIAL', clientCancellationPolicyEnabled: false });
    await handler.execute({ branchId: null, bufferMinutes: 5 });
    expect(prisma.bookingSettings.update).toHaveBeenCalledWith({ where: { id: dbSettings.id }, data: { bufferMinutes: 5 } });
  });
  it('validates activation when creating a new row', async () => {
    const { handler, prisma } = setup(null);
    await expect(handler.execute({ branchId: null, clientCancellationPolicyEnabled: true } as never)).rejects.toThrow();
    expect(prisma.bookingSettings.create).not.toHaveBeenCalled();
  });
});
