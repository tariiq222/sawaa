import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import { RegisterFcmTokenDto } from './register-fcm-token.dto';

export type RegisterFcmTokenCommand = RegisterFcmTokenDto & { clientId: string };

@Injectable()
export class RegisterFcmTokenHandler {
  constructor(private readonly transactions: RlsTransactionService) {}

  async execute(cmd: RegisterFcmTokenCommand) {
    return this.transactions.withTransaction(async (tx) => {
      // Serialize device ownership changes, then account closure/registration.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('sawaa:fcm'), hashtext(${cmd.token}))`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${cmd.clientId} FOR UPDATE`);
      const client = await tx.client.findFirst({
        where: { id: cmd.clientId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!client) throw new NotFoundException('Client not found');

      // A shared device must stop receiving the previous account's messages.
      await tx.fcmToken.deleteMany({ where: { token: cmd.token, clientId: { not: cmd.clientId } } });
      return tx.fcmToken.upsert({
        where: { fcm_token_per_client: { clientId: cmd.clientId, token: cmd.token } },
        create: { clientId: cmd.clientId, token: cmd.token, platform: cmd.platform },
        update: { platform: cmd.platform, lastSeenAt: new Date() },
      });
    });
  }
}
