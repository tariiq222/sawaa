import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import { NativeSessionLookup } from './native-session.lookup';

@Injectable()
export class NativeLogoutHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly lookup: NativeSessionLookup,
  ) {}

  async execute(rawToken: string): Promise<void> {
    const matched = await this.lookup.find(rawToken, { activeOnly: true });
    if (!matched) return;

    await this.rlsTransaction.withTransaction(async (tx) => {
      if (matched.kind === 'client') {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${matched.clientId} FOR UPDATE`);
        const stillActive = await tx.clientRefreshToken.findFirst({ where: { id: matched.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
        if (!stillActive) return;
        await tx.clientRefreshToken.updateMany({ where: { clientId: matched.clientId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.fcmToken.deleteMany({ where: { clientId: matched.clientId } });
        await tx.client.update({ where: { id: matched.clientId }, data: { tokenVersion: { increment: 1 } } });
        return;
      }

      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${matched.userId} FOR UPDATE`);
      const user = await tx.user.findUnique({ where: { id: matched.userId }, select: { id: true, role: true } });
      // A historical User CLIENT refresh token is intentionally inert: it must
      // not revoke a separately issued Client session family.
      if (user?.role === 'CLIENT') return;
      const stillActive = await tx.refreshToken.findFirst({ where: { id: matched.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
      if (!stillActive) return;
      await tx.refreshToken.updateMany({ where: { userId: matched.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.user.update({ where: { id: matched.userId }, data: { tokenVersion: { increment: 1 } } });
    });
  }
}
