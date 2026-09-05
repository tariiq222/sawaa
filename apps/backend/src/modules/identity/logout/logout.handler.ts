import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import type { LogoutCommand } from './logout.command';

@Injectable()
export class LogoutHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: LogoutCommand): Promise<void> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${cmd.userId} FOR UPDATE`);
      await tx.refreshToken.updateMany({
        where: { userId: cmd.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.user.update({
        where: { id: cmd.userId },
        data: { tokenVersion: { increment: 1 } },
      });
    });
  }
}
