import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isEmail } from 'class-validator';
import { RlsTransactionService } from '../../../infrastructure/database';
import { ClientEmailStatusDto, ClientEmailStatusValue } from './client-email.response';

type EmailFields = {
  email: string | null;
  emailVerified: Date | null;
  pendingEmail: string | null;
  emailPromptResolvedAt: Date | null;
};

@Injectable()
export class ClientEmailStore {
  constructor(private readonly transactions: RlsTransactionService) {}
  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) { return this.transactions.withTransaction(run, { timeout: 15000 }); }
  normalize(value: string): string {
    const email = value.trim().toLowerCase();
    if (!isEmail(email)) throw new BadRequestException({ code: 'invalid_email' });
    return email;
  }
  // Locks the caller's own client row so concurrent challenges serialize.
  async owner(tx: Prisma.TransactionClient, clientId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR UPDATE`);
    const client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client || !client.isActive || client.deletedAt) throw new ForbiddenException({ code: 'client_unavailable' });
    return client;
  }
}

// Case-insensitive comparison after the shared normalization policy.
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? '').trim().toLowerCase();
  const right = (b ?? '').trim().toLowerCase();
  return left !== '' && left === right;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

// GET contract: a legacy unverified email is never returned; only a verified
// email is. Precedence: verified > pending > unverified > none.
export function clientEmailStatus(client: EmailFields): ClientEmailStatusDto {
  const email = client.email && client.email.trim() ? client.email : null;
  const pendingEmail = client.pendingEmail && client.pendingEmail.trim() ? client.pendingEmail : null;
  const verified = client.emailVerified !== null && email !== null;
  const status: ClientEmailStatusValue = verified ? 'verified' : pendingEmail !== null ? 'pending' : email !== null ? 'unverified' : 'none';
  return {
    status,
    email: verified ? email : null,
    pendingEmail,
    prompt: client.emailVerified === null && email !== null && client.emailPromptResolvedAt === null,
  };
}
