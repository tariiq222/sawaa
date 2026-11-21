import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionService } from '../../../infrastructure/database';
import { NativeSessionLookup } from './native-session.lookup';
import { CLIENT_ACCOUNT_STORE, type ClientAccountStore } from '../../../common/contracts/client-account.contract';

@Injectable()
export class NativeLogoutHandler {
  constructor(
    private readonly rlsTransaction: TransactionService,
    private readonly lookup: NativeSessionLookup,
    @Inject(CLIENT_ACCOUNT_STORE) private readonly accounts: ClientAccountStore,
  ) {}

  async execute(rawToken: string): Promise<void> {
    const matched = await this.lookup.find(rawToken, { activeOnly: true });
    if (!matched) return;

    await this.rlsTransaction.withTransaction(async (tx) => {
      if (matched.kind === 'client') {
        const locked = await this.accounts.lockForAuth(tx, matched.clientId);
        const stillActive = await tx.clientRefreshToken.findFirst({ where: { id: matched.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
        if (!locked || !stillActive) return;
        await tx.clientRefreshToken.updateMany({ where: { clientId: matched.clientId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.fcmToken.deleteMany({ where: { clientId: matched.clientId } });
        await this.accounts.bumpTokenVersion(tx, matched.clientId);
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
