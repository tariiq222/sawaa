import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

@Injectable()
export class RefreshTokenCleanupCron {
  private readonly logger = new Logger(RefreshTokenCleanupCron.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<void> {
    await withCronLeader(this.prisma, 'refresh-token-cleanup', async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: cutoff } },
            { revokedAt: { not: null, lte: cutoff } },
          ],
        },
      });
      this.logger.log(`deleted ${result.count} stale tokens`);

      const deletedResetTokens = await this.prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: cutoff } },
            { consumedAt: { not: null } },
          ],
        },
      });
      this.logger.log(`Cleaned up ${deletedResetTokens.count} expired/consumed PasswordResetTokens`);
    });
  }
}
