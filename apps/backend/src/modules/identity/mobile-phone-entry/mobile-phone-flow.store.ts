import { Injectable } from '@nestjs/common';
import { MobilePhoneEntryFlow, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { RlsTransactionService } from '../../../common/database/rls-transaction';
import { hashContinuation } from '../mobile-email-entry/mobile-email-flow.store';

export { codeHash, newCode, newContinuation, hashContinuation } from '../mobile-email-entry/mobile-email-flow.store';

const FLOW_LIFETIME_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class MobilePhoneFlowStore {
  constructor(private readonly prisma: PrismaService, private readonly transactions: RlsTransactionService) {}

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.transactions.withTransaction(run, { timeout: 15000 });
  }

  async lock(tx: Prisma.TransactionClient, id: string): Promise<MobilePhoneEntryFlow | null> {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MobilePhoneEntryFlow" WHERE "id" = ${id} FOR UPDATE`);
    return tx.mobilePhoneEntryFlow.findUnique({ where: { id } });
  }

  async lockContinuation(tx: Prisma.TransactionClient, token: string): Promise<MobilePhoneEntryFlow | null> {
    const continuationHash = hashContinuation(token);
    const candidate = await tx.mobilePhoneEntryFlow.findUnique({ where: { continuationHash } });
    if (!candidate) return null;
    const flow = await this.lock(tx, candidate.id);
    // Recheck after locking: a resend may have rotated the proof while we waited.
    return flow && flow.continuationHash === continuationHash && flow.state === 'DETAILS_PENDING' &&
      this.liveFlow(flow) && !!flow.continuationExpiresAt && flow.continuationExpiresAt.getTime() > Date.now()
      ? flow : null;
  }

  liveFlow(flow: MobilePhoneEntryFlow): boolean {
    return (flow.state === 'CODE_PENDING' || flow.state === 'DETAILS_PENDING') &&
      flow.consumedAt === null && flow.createdAt.getTime() + FLOW_LIFETIME_MS > Date.now();
  }

  /** Caller must hold the row lock and commit false before emitting a verification error. */
  async checkCode(tx: Prisma.TransactionClient, flow: MobilePhoneEntryFlow, code: string): Promise<boolean> {
    if (!this.liveFlow(flow) || flow.state !== 'CODE_PENDING' || !flow.codeHash ||
      flow.codeExpiresAt.getTime() <= Date.now() || flow.attempts >= MAX_ATTEMPTS) return false;
    if (await bcrypt.compare(code, flow.codeHash)) return true;
    await tx.mobilePhoneEntryFlow.update({ where: { id: flow.id }, data: { attempts: { increment: 1 } } });
    // Do not throw: throwing would roll back the wrong attempt.
    return false;
  }

  /** Caller must hold the row lock; identity mutation and consumption share the transaction. */
  async consume(tx: Prisma.TransactionClient, flow: MobilePhoneEntryFlow): Promise<boolean> {
    if (!this.liveFlow(flow)) return false;
    const changed = await tx.mobilePhoneEntryFlow.updateMany({
      where: { id: flow.id, state: flow.state, consumedAt: null },
      data: { state: 'CONSUMED', consumedAt: new Date(), codeHash: null, continuationHash: null },
    });
    return changed.count === 1;
  }
}
