import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { ClientEmailStore, clientEmailStatus } from './client-email.store';
import { VerifyClientEmailDto } from './client-email.dto';
import { ClientEmailStatusDto } from './client-email.response';
import { detailsUnavailable, invalidCode, translateConflict } from '../mobile-email-entry/mobile-email-errors';

// Two owners racing for each other's unverified addresses can deadlock;
// PostgreSQL aborts one side (P2034). Report it like any ownership clash.
function translateVerifyConflict(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') throw detailsUnavailable();
  return translateConflict(error);
}

@Injectable()
export class VerifyClientEmailHandler {
  private readonly logger = new Logger(VerifyClientEmailHandler.name);
  constructor(private readonly store: ClientEmailStore, private readonly prisma: PrismaService) {}
  async execute(clientId: string, input: VerifyClientEmailDto): Promise<ClientEmailStatusDto> {
    // Error sentinels are returned (not thrown) so the transaction COMMITS:
    // a failed attempt must be persisted before the HTTP error goes out.
    const outcome = await this.store.transaction(async tx => {
      const client = await this.store.owner(tx, clientId);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ClientEmailChallenge" WHERE "id" = ${input.challengeId} FOR UPDATE`);
      const challenge = await tx.clientEmailChallenge.findUnique({ where: { id: input.challengeId } });
      if (!challenge || challenge.clientId !== clientId || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return { error: 'code' as const };
      if (!await bcrypt.compare(input.code, challenge.codeHash)) {
        await tx.clientEmailChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
        return { error: 'code' as const };
      }
      const address = challenge.email;
      // A linked user that is not a CLIENT login identity cannot absorb this address.
      const linked = client.userId ? await tx.user.findUnique({ where: { id: client.userId } }) : null;
      if (client.userId && (!linked || linked.role !== 'CLIENT')) return { error: 'conflict' as const };
      // A User login identity already owns this address (the linked user is migrated below).
      const userHolder = await tx.user.findFirst({
        where: { email: { equals: address, mode: 'insensitive' }, ...(client.userId ? { id: { not: client.userId } } : {}) },
        select: { id: true },
      });
      if (userHolder) return { error: 'conflict' as const };
      const holders = await tx.client.findMany({
        where: { email: { equals: address, mode: 'insensitive' }, deletedAt: null, id: { not: clientId } },
        select: { id: true, emailVerified: true },
      });
      // A verified owner elsewhere keeps the address.
      if (holders.some(holder => holder.emailVerified !== null)) return { error: 'conflict' as const };
      // Unverified copies release the address: the verifying owner wins. The
      // write is conditional and re-evaluated under the row lock, so a holder
      // that meanwhile verified or changed its email is never touched; any
      // remaining clash surfaces as a unique conflict (409) below.
      const released: string[] = [];
      for (const holder of holders) {
        const cleared = await tx.client.updateMany({
          where: { id: holder.id, deletedAt: null, emailVerified: null, email: { equals: address, mode: 'insensitive' } },
          data: { email: null },
        });
        if (cleared.count === 1) released.push(holder.id);
      }
      const now = new Date();
      await tx.client.update({ where: { id: clientId }, data: { email: address, emailVerified: now, pendingEmail: null, emailPromptResolvedAt: now } });
      if (linked) await tx.user.update({ where: { id: linked.id }, data: { email: address, emailVerifiedAt: now } });
      await tx.clientEmailChallenge.updateMany({ where: { clientId, consumedAt: null }, data: { consumedAt: now } });
      return { released };
    }).catch(translateVerifyConflict);
    if ('error' in outcome) throw outcome.error === 'code' ? invalidCode() : detailsUnavailable();
    // Structured audit: both client ids only — never the address itself.
    for (const releasedClientId of outcome.released) {
      this.logger.log({ event: 'client_email.unverified_released', clientId, releasedClientId });
    }
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { status: 'none', email: null, pendingEmail: null, prompt: false };
    return clientEmailStatus(client);
  }
}
