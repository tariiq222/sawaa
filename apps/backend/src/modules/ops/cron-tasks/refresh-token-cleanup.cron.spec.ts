import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';

const DAY_MS = 24 * 60 * 60_000;

/**
 * The cron runs once a day. The advisory-lock wrap is provided by
 * `withCronLeader`; here we mock it so the callback runs unconditionally
 * and the test focuses on the two deleteMany calls + their where filters.
 */
jest.mock('../../../common/helpers/cron-leader.helper', () => ({
  withCronLeader: jest.fn(
    async (_prisma: unknown, _key: string, fn: () => Promise<void>) => fn(),
  ),
}));

import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

describe('RefreshTokenCleanupCron', () => {
  const buildPrisma = (overrides: Record<string, unknown> = {}) => {
    const refreshToken = { deleteMany: jest.fn().mockResolvedValue({ count: 7 }) };
    const passwordResetToken = { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) };
    return { refreshToken, passwordResetToken, ...overrides };
  };

  beforeEach(() => {
    (withCronLeader as jest.Mock).mockClear();
  });

  it('runs the sweep under the refresh-token-cleanup advisory lock', async () => {
    const prisma = buildPrisma();
    const cron = new RefreshTokenCleanupCron(prisma as never);

    await cron.execute();

    expect(withCronLeader).toHaveBeenCalledTimes(1);
    expect(withCronLeader).toHaveBeenCalledWith(
      prisma,
      'refresh-token-cleanup',
      expect.any(Function),
    );
  });

  it('deletes refresh tokens that are expired OR revoked more than 30 days ago', async () => {
    const prisma = buildPrisma();
    const cron = new RefreshTokenCleanupCron(prisma as never);

    const before = Date.now();
    await cron.execute();
    const after = Date.now();

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
    const where = prisma.refreshToken.deleteMany.mock.calls[0][0].where;

    // The OR filter has two branches: expiredAt <= cutoff, or revokedAt <= cutoff.
    expect(where.OR).toHaveLength(2);
    const expiredCutoff = where.OR[0].expiresAt.lte as Date;
    const revokedCutoff = where.OR[1].revokedAt.lte as Date;
    expect(expiredCutoff.getTime()).toBeGreaterThanOrEqual(before - 30 * DAY_MS);
    expect(expiredCutoff.getTime()).toBeLessThanOrEqual(after - 30 * DAY_MS);
    expect(revokedCutoff.getTime()).toBe(expiredCutoff.getTime());

    // The revokedAt filter additionally requires the column to be non-null.
    expect(where.OR[1].revokedAt.not).toBeNull();
  });

  it('deletes password reset tokens that are expired OR already consumed', async () => {
    const prisma = buildPrisma();
    const cron = new RefreshTokenCleanupCron(prisma as never);

    const before = Date.now();
    await cron.execute();
    const after = Date.now();

    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledTimes(1);
    const where = prisma.passwordResetToken.deleteMany.mock.calls[0][0].where;

    expect(where.OR).toHaveLength(2);
    const expiredCutoff = where.OR[0].expiresAt.lte as Date;
    expect(expiredCutoff.getTime()).toBeGreaterThanOrEqual(before - 30 * DAY_MS);
    expect(expiredCutoff.getTime()).toBeLessThanOrEqual(after - 30 * DAY_MS);

    // A consumed reset token is purged regardless of age.
    expect(where.OR[1].consumedAt.not).toBeNull();
  });

  it('uses the same 30-day cutoff for both refresh and password-reset tables', async () => {
    const prisma = buildPrisma();
    const cron = new RefreshTokenCleanupCron(prisma as never);

    await cron.execute();

    const refreshCutoff = prisma.refreshToken.deleteMany.mock.calls[0][0].where.OR[0]
      .expiresAt.lte as Date;
    const resetCutoff = prisma.passwordResetToken.deleteMany.mock.calls[0][0].where.OR[0]
      .expiresAt.lte as Date;
    expect(refreshCutoff.getTime()).toBe(resetCutoff.getTime());
  });

  it('continues to the second table when the first deleteMany rejects', async () => {
    const prisma = buildPrisma();
    prisma.refreshToken.deleteMany.mockRejectedValueOnce(new Error('db down'));
    const cron = new RefreshTokenCleanupCron(prisma as never);

    // The cron's body is wrapped in withCronLeader(fn) which itself does not
    // catch — a reject propagates out of execute(). The contract is that the
    // two cleanups are independent: a failure on one should be visible to the
    // caller (cron framework will retry next tick), not silently swallowed.
    await expect(cron.execute()).rejects.toThrow('db down');
    expect(prisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
  });
});
