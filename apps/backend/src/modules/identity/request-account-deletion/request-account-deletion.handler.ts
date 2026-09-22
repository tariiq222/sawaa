import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';

export interface RequestAccountDeletionCommand {
  clientId: string;
}

export interface RequestAccountDeletionResult {
  status: 'scheduled';
  retained: readonly ['clinical_records', 'financial_records'];
}

/**
 * Self-service account closure for the mobile client.
 *
 * Apple requires an in-app way to start deletion. Counseling records,
 * invoices, and ratings stay: they are the center's clinical and financial
 * record. What this closes is the login itself — contact fields used to sign
 * in are removed, sessions are revoked, and the row is marked deleted so
 * ClientJwtStrategy refuses it. The phone is not copied into notes.
 */
@Injectable()
export class RequestAccountDeletionHandler {
  constructor(private readonly rlsTransaction: RlsTransactionService) {}

  async execute(cmd: RequestAccountDeletionCommand): Promise<RequestAccountDeletionResult> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${cmd.clientId} FOR UPDATE`);
      const client = await tx.client.findFirst({
        where: { id: cmd.clientId, deletedAt: null, isActive: true },
        select: { id: true, userId: true },
      });
      if (!client) throw new UnauthorizedException('Account is inactive');

      if (client.userId) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${client.userId} FOR UPDATE`);
      }

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
          nationalId: null,
          emergencyName: null,
          emergencyPhone: null,
          avatarUrl: null,
          passwordHash: null,
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
              email: `deleted-${user.id}@account.invalid`,
              passwordHash: null,
              tokenVersion: { increment: 1 },
            },
          });
        }
      }
    });

    return { status: 'scheduled', retained: ['clinical_records', 'financial_records'] };
  }
}
