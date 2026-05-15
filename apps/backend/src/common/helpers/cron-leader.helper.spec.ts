import { withCronLeader } from './cron-leader.helper';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('withCronLeader', () => {
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
    };
  });

  it('should run fn when lock acquired', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ v: BigInt(123) }])
      .mockResolvedValueOnce([{ acquired: true }]);

    const fn = jest.fn().mockResolvedValue(undefined);
    await withCronLeader(prisma as PrismaService, 'test-cron', fn);
    expect(fn).toHaveBeenCalled();
  });

  it('should skip when lock not acquired', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ v: BigInt(123) }])
      .mockResolvedValueOnce([{ acquired: false }]);

    const fn = jest.fn().mockResolvedValue(undefined);
    await withCronLeader(prisma as PrismaService, 'test-cron', fn);
    expect(fn).not.toHaveBeenCalled();
  });
});
