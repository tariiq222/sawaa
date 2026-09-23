import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';

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
  constructor(private readonly rlsTransaction: RlsTransactionService) {}

  async execute(cmd: RequestAccountDeletionCommand): Promise<RequestAccountDeletionResult> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      // OTP verification locks User before Client. Match that order to avoid
      // deadlocks if a login and closure arrive together.
      const initial = await tx.client.findUnique({
        where: { id: cmd.clientId },
        select: { userId: true },
      });
      if (initial?.userId) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${initial.userId} FOR UPDATE`);
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${cmd.clientId} FOR UPDATE`);
      const client = await tx.client.findFirst({
        where: { id: cmd.clientId, deletedAt: null, isActive: true },
        select: { id: true, userId: true },
      });
      if (!client) throw new UnauthorizedException('Account is inactive');
      if (client.userId !== initial?.userId) throw new ConflictException('Account link changed');

      const now = new Date();
      await tx.clientRefreshToken.updateMany({
        where: { clientId: client.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.fcmToken.deleteMany({ where: { clientId: client.id } });
      await tx.client.update({
        where: { id: client.id },
        data: {
          deletedAt: now,
          isActive: false,
          phone: null,
          email: null,
          emailVerified: null,
          phoneVerified: null,
          nationalId: null,
          emergencyName: null,
          emergencyPhone: null,
          avatarUrl: null,
          passwordHash: null,
          pushEnabled: false,
          tokenVersion: { increment: 1 },
        },
      });

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
