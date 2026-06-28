import { DataRetentionCron } from './data-retention.cron';

const DAY_MS = 24 * 60 * 60_000;

/**
 * withCronLeader acquires a lease via one $queryRaw (returns a row when
 * acquired) and releases via $executeRaw.
 */
const buildPrisma = () => ({
  $queryRaw: jest
    .fn()
    .mockResolvedValueOnce([{ acquired: true }])
    .mockResolvedValue([]),
  $executeRaw: jest.fn().mockResolvedValue(1),
  otpCode: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  activityLog: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
  notification: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
  smsDelivery: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
  notificationDeliveryLog: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
});

const buildConfig = (overrides: Record<string, string> = {}) => ({
  get: jest.fn((key: string) => overrides[key]),
});

describe('DataRetentionCron', () => {
  it('purges every target table once with a strict-less-than cutoff', async () => {
    const prisma = buildPrisma();
    const config = buildConfig();
    const cron = new DataRetentionCron(prisma as never, config as never);

    await expect(cron.execute()).resolves.not.toThrow();

    expect(prisma.otpCode.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.activityLog.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.notification.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.smsDelivery.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDeliveryLog.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('keys each table on the correct timestamp field', async () => {
    const prisma = buildPrisma();
    const cron = new DataRetentionCron(prisma as never, buildConfig() as never);

    await cron.execute();

    expect(prisma.otpCode.deleteMany.mock.calls[0][0].where).toHaveProperty('expiresAt');
    expect(prisma.activityLog.deleteMany.mock.calls[0][0].where).toHaveProperty('occurredAt');
    expect(prisma.notification.deleteMany.mock.calls[0][0].where).toHaveProperty('createdAt');
    expect(prisma.smsDelivery.deleteMany.mock.calls[0][0].where).toHaveProperty('createdAt');
    expect(prisma.notificationDeliveryLog.deleteMany.mock.calls[0][0].where).toHaveProperty(
      'createdAt',
    );
  });

  it('computes cutoffs from the default windows (otp=30d, activity=365d, others=90d)', async () => {
    const prisma = buildPrisma();
    const cron = new DataRetentionCron(prisma as never, buildConfig() as never);

    const before = Date.now();
    await cron.execute();
    const after = Date.now();

    const otpCutoff = prisma.otpCode.deleteMany.mock.calls[0][0].where.expiresAt.lt as Date;
    const activityCutoff = prisma.activityLog.deleteMany.mock.calls[0][0].where.occurredAt
      .lt as Date;
    const notificationCutoff = prisma.notification.deleteMany.mock.calls[0][0].where.createdAt
      .lt as Date;

    expect(otpCutoff.getTime()).toBeGreaterThanOrEqual(before - 30 * DAY_MS);
    expect(otpCutoff.getTime()).toBeLessThanOrEqual(after - 30 * DAY_MS);

    expect(activityCutoff.getTime()).toBeGreaterThanOrEqual(before - 365 * DAY_MS);
    expect(activityCutoff.getTime()).toBeLessThanOrEqual(after - 365 * DAY_MS);

    expect(notificationCutoff.getTime()).toBeGreaterThanOrEqual(before - 90 * DAY_MS);
    expect(notificationCutoff.getTime()).toBeLessThanOrEqual(after - 90 * DAY_MS);
  });

  it('honors env-overridable retention windows', async () => {
    const prisma = buildPrisma();
    const config = buildConfig({ RETENTION_OTP_DAYS: '7' });
    const cron = new DataRetentionCron(prisma as never, config as never);

    const before = Date.now();
    await cron.execute();
    const after = Date.now();

    const otpCutoff = prisma.otpCode.deleteMany.mock.calls[0][0].where.expiresAt.lt as Date;
    expect(otpCutoff.getTime()).toBeGreaterThanOrEqual(before - 7 * DAY_MS);
    expect(otpCutoff.getTime()).toBeLessThanOrEqual(after - 7 * DAY_MS);
  });

  it('falls back to the default when an env window is invalid or zero', async () => {
    const prisma = buildPrisma();
    const config = buildConfig({ RETENTION_OTP_DAYS: 'not-a-number', RETENTION_NOTIFICATION_DAYS: '0' });
    const cron = new DataRetentionCron(prisma as never, config as never);

    const before = Date.now();
    await cron.execute();
    const after = Date.now();

    const otpCutoff = prisma.otpCode.deleteMany.mock.calls[0][0].where.expiresAt.lt as Date;
    const notificationCutoff = prisma.notification.deleteMany.mock.calls[0][0].where.createdAt
      .lt as Date;
    // invalid → default 30d
    expect(otpCutoff.getTime()).toBeGreaterThanOrEqual(before - 30 * DAY_MS);
    expect(otpCutoff.getTime()).toBeLessThanOrEqual(after - 30 * DAY_MS);
    // zero → default 90d
    expect(notificationCutoff.getTime()).toBeGreaterThanOrEqual(before - 90 * DAY_MS);
    expect(notificationCutoff.getTime()).toBeLessThanOrEqual(after - 90 * DAY_MS);
  });

  it('isolates a per-table failure: one table throwing does not abort the others', async () => {
    const prisma = buildPrisma();
    prisma.activityLog.deleteMany.mockRejectedValueOnce(new Error('db lock timeout'));
    const cron = new DataRetentionCron(prisma as never, buildConfig() as never);

    await expect(cron.execute()).resolves.not.toThrow();

    // every other table is still purged despite ActivityLog failing
    expect(prisma.otpCode.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.activityLog.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.notification.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.smsDelivery.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDeliveryLog.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('acquires and releases the cron lease around the sweep', async () => {
    const prisma = buildPrisma();
    const cron = new DataRetentionCron(prisma as never, buildConfig() as never);

    await cron.execute();

    // Lease acquire is one $queryRaw; release is one $executeRaw.
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});
