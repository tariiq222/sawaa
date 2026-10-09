import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';

@Injectable()
export class ClientPhoneStore {
  constructor(private readonly transactions: RlsTransactionService) {}

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.transactions.withTransaction(run, { timeout: 15000 });
  }

  /** Locks the caller's own client row so phone changes serialize per account. */
  async owner(tx: Prisma.TransactionClient, clientId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR UPDATE`);
    const client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client || !client.isActive || client.deletedAt) throw new ForbiddenException({ code: 'client_unavailable' });
    return client;
  }
}

export const maskPhone = (phone: string) => `${phone.slice(0, 4)}***${phone.slice(-2)}`;
