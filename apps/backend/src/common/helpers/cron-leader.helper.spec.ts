import { withCronLeader } from './cron-leader.helper';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('withCronLeader', () => {
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
  });

  it('runs fn when the lease is acquired', async () => {
    // Acquire upsert RETURNING "name" → non-empty array means we won the lease.
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ name: 'test-cron' }]);

    const fn = jest.fn().mockResolvedValue(undefined);
    await withCronLeader(prisma as PrismaService, 'test-cron', fn);

    expect(fn).toHaveBeenCalled();
  });

  it('releases the lease after fn completes', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ name: 'test-cron' }]);

    const fn = jest.fn().mockResolvedValue(undefined);
    await withCronLeader(prisma as PrismaService, 'test-cron', fn);

    // Release is a best-effort $executeRaw UPDATE scoped to our owner.
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('skips fn when the lease is held by another instance', async () => {
    // Conflict + active lease → upsert WHERE fails → no row returned.
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const fn = jest.fn().mockResolvedValue(undefined);
    await withCronLeader(prisma as PrismaService, 'test-cron', fn);

    expect(fn).not.toHaveBeenCalled();
    // No lease owned → nothing to release.
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('still releases the lease when fn throws', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ name: 'test-cron' }]);

    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(
      withCronLeader(prisma as PrismaService, 'test-cron', fn),
    ).rejects.toThrow('boom');

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('does not throw when the release fails (best-effort)', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ name: 'test-cron' }]);
    (prisma.$executeRaw as jest.Mock).mockRejectedValue(new Error('db gone'));

    const fn = jest.fn().mockResolvedValue(undefined);
    await expect(
      withCronLeader(prisma as PrismaService, 'test-cron', fn),
    ).resolves.toBeUndefined();
  });
});
