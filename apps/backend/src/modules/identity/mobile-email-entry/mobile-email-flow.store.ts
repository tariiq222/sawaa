import { Injectable } from '@nestjs/common';
import { MobileEmailFlow, Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { RlsTransactionService } from '../../../common/database/rls-transaction';

export const hashContinuation = (token: string) => createHash('sha256').update(token).digest('hex');
export const newContinuation = () => randomBytes(32).toString('base64url');
export const newCode = () => randomInt(0, 1000000).toString().padStart(6, '0');
export const codeHash = (code: string) => bcrypt.hash(code, 10);

@Injectable()
export class MobileEmailFlowStore {
  constructor(private readonly prisma: PrismaService, private readonly transactions: RlsTransactionService) {}

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.transactions.withTransaction(run, { timeout: 15000 });
  }

  async lock(tx: Prisma.TransactionClient, id: string): Promise<MobileEmailFlow | null> {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MobileEmailFlow" WHERE "id" = ${id} FOR UPDATE`);
    return tx.mobileEmailFlow.findUnique({ where: { id } });
  }

  async lockContinuation(tx: Prisma.TransactionClient, token: string): Promise<MobileEmailFlow | null> {
    const continuationHash = hashContinuation(token);
    const candidate = await tx.mobileEmailFlow.findUnique({ where: { continuationHash } });
    if (!candidate) return null;
    const flow = await this.lock(tx, candidate.id);
    return flow?.continuationHash === continuationHash && this.liveContinuation(flow) ? flow : null;
  }

  liveContinuation(flow: MobileEmailFlow): boolean {
    const now = Date.now();
    return flow.consumedAt === null && !!flow.continuationExpiresAt &&
      flow.continuationExpiresAt.getTime() > now && flow.createdAt.getTime() + 900000 > now;
  }

  async checkCode(tx: Prisma.TransactionClient, flow: MobileEmailFlow, phase: 'email' | 'phone', code: string): Promise<boolean> {
    const email = phase === 'email';
    const hash = email ? flow.emailCodeHash : flow.phoneCodeHash;
    const expiry = email ? flow.emailExpiresAt : flow.phoneExpiresAt;
    const attempts = email ? flow.emailAttempts : flow.phoneAttempts;
    if (flow.state !== (email ? 'EMAIL_PENDING' : 'PHONE_PENDING') || !hash || !expiry || expiry <= new Date() || attempts >= 5) return false;
    if (await bcrypt.compare(code, hash)) return true;
    await tx.mobileEmailFlow.update({ where: { id: flow.id }, data: email ? { emailAttempts: { increment: 1 } } : { phoneAttempts: { increment: 1 } } });
    // Returning a sentinel lets the caller COMMIT attempts before emitting 400.
    return false;
  }

  async consume(tx: Prisma.TransactionClient, flow: MobileEmailFlow): Promise<boolean> {
    if (flow.state !== 'EMAIL_PENDING' && flow.state !== 'PHONE_PENDING') return false;
    const changed = await tx.mobileEmailFlow.updateMany({ where: { id: flow.id, state: flow.state, consumedAt: null }, data: {
      state: 'CONSUMED', consumedAt: new Date(), emailCodeHash: null, phoneCodeHash: null, continuationHash: null,
    } });
    return changed.count === 1;
  }

  async settleEmail(id: string, accepted: boolean): Promise<boolean> {
    const result = await this.prisma.mobileEmailFlow.updateMany({ where: { id, state: 'EMAIL_SENDING' }, data: accepted ? { state: 'EMAIL_PENDING' } : { state: 'FAILED', emailCodeHash: null } });
    return result.count === 1;
  }

  async settlePhone(id: string, phoneChallengeId: string, accepted: boolean, continuationHash?: string): Promise<boolean> {
    const result = await this.prisma.mobileEmailFlow.updateMany({ where: { id, state: 'PHONE_SENDING', phoneChallengeId }, data: accepted ? { state: 'PHONE_PENDING', ...(continuationHash ? { continuationHash } : {}) } : { state: 'DETAILS_PENDING', phoneCodeHash: null, phoneChallengeId: null } });
    return result.count === 1;
  }
}
