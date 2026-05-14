import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { LogoutCommand } from './logout.command';

@Injectable()
export class LogoutHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: LogoutCommand): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId: cmd.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: cmd.userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }
}
