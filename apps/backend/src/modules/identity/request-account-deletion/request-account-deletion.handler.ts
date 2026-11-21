import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionService } from '../../../infrastructure/database';
import { CLIENT_ACCOUNT_STORE, type ClientAccountStore } from '../../../common/contracts/client-account.contract';

export interface RequestAccountDeletionCommand {
  clientId: string;
}

export interface RequestAccountDeletionResult {
  status: 'closed';
  retained: readonly ['clinical_records', 'financial_records'];
}

/**
 * Self-service account closure for the mobile client.
 *
 * Close login immediately while preserving the client's clinical and financial
 * record. Contact credentials are cleared, sessions revoked, and the client
 * row is marked inactive so ClientJwtStrategy refuses existing access tokens.
 */
@Injectable()
export class RequestAccountDeletionHandler {
  constructor(
    private readonly rlsTransaction: TransactionService,
    @Inject(CLIENT_ACCOUNT_STORE) private readonly accounts: ClientAccountStore,
  ) {}

  async execute(cmd: RequestAccountDeletionCommand): Promise<RequestAccountDeletionResult> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      // OTP verification locks User before Client. Match that order to avoid
      // deadlocks if a login and closure arrive together. The Client row lock
      // and re-read go through the people-owned store.
      const initial = await tx.client.findUnique({
        where: { id: cmd.clientId },
        select: { userId: true },
      });
      if (initial?.userId) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${initial.userId} FOR UPDATE`);
      }
      const locked = await this.accounts.lockForAuth(tx, cmd.clientId);
      const client = locked && !locked.deletedAt && locked.isActive
        ? { id: locked.id, userId: locked.userId }
        : null;
      if (!client) throw new UnauthorizedException('Account is inactive');
      if (client.userId !== initial?.userId) throw new ConflictException('Account link changed');

      const now = new Date();
      await tx.clientRefreshToken.updateMany({
        where: { clientId: client.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.fcmToken.deleteMany({ where: { clientId: client.id } });
      await this.accounts.anonymizeForDeletion(tx, client.id, now);

      if (client.userId) {
        const user = await tx.user.findUnique({
          where: { id: client.userId },
          select: { id: true, role: true },
        });
        if (user?.role === 'CLIENT') {
          await tx.refreshToken.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: now },
          });
          await tx.user.update({
            where: { id: user.id },
            data: {
              isActive: false,
              phone: null,
              phoneVerifiedAt: null,
              emailVerifiedAt: null,
              email: `deleted-${user.id}@account.invalid`,
              passwordHash: null,
              tokenVersion: { increment: 1 },
            },
          });
        }
      }
    });

    return { status: 'closed', retained: ['clinical_records', 'financial_records'] };
  }
}
