import { applyLegacyImportPlan } from './legacy-import.writer';

describe('legacy import compatibility boundary', () => {
  it('refuses historical writes once the intake history schema is installed', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ historyInstalled: true }]),
      $transaction: jest.fn().mockResolvedValue({ insertedBookings: 1 }),
    };

    await expect(
      applyLegacyImportPlan(prisma as never, {} as never, {} as never),
    ).rejects.toThrow('Legacy import apply is disabled after intake history expansion');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows the prior offline importer on its original schema', async () => {
    const report = { insertedBookings: 1 };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ historyInstalled: false }]),
      $transaction: jest.fn().mockResolvedValue(report),
    };
    await expect(
      applyLegacyImportPlan(prisma as never, {} as never, {} as never),
    ).resolves.toEqual(report);
  });

  it('fails closed if compatibility cannot be established', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')),
      $transaction: jest.fn().mockResolvedValue({ insertedBookings: 1 }),
    };
    await expect(
      applyLegacyImportPlan(prisma as never, {} as never, {} as never),
    ).rejects.toThrow('database unavailable');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
