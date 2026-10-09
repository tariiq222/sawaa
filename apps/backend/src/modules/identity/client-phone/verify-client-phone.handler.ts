import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ClientTokenService } from '../shared/client-token.service';
import { detailsUnavailable, invalidCode, translateConflict } from '../mobile-email-entry/mobile-email-errors';
import { ClientPhoneStore } from './client-phone.store';
import { VerifyClientPhoneDto } from './client-phone.dto';
import { ClientPhoneVerifiedDto } from './client-phone.response';

const MAX_ATTEMPTS = 5;

// A deadlock abort (P2034) is reported like any other ownership clash.
function translateVerifyConflict(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') throw detailsUnavailable();
  return translateConflict(error);
}

@Injectable()
export class VerifyClientPhoneHandler {
  private readonly logger = new Logger(VerifyClientPhoneHandler.name);
  constructor(private readonly store: ClientPhoneStore, private readonly tokens: ClientTokenService) {}

  async execute(clientId: string, input: VerifyClientPhoneDto): Promise<ClientPhoneVerifiedDto> {
    // Error sentinels are returned (not thrown) so a wrong attempt COMMITS.
    const outcome = await this.store.transaction(async tx => {
      const client = await this.store.owner(tx, clientId);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ClientPhoneChallenge" WHERE "id" = ${input.challengeId} FOR UPDATE`);
      const challenge = await tx.clientPhoneChallenge.findUnique({ where: { id: input.challengeId } });
      if (!challenge || challenge.clientId !== clientId || challenge.consumedAt || challenge.expiresAt <= new Date() ||
          challenge.attempts >= MAX_ATTEMPTS) return { error: 'code' as const };
      if (!await bcrypt.compare(input.code, challenge.codeHash)) {
        await tx.clientPhoneChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
        return { error: 'code' as const };
      }
      const phone = challenge.phone;
      // Ownership is decided only now, after the code proved the new number.
      const otherClient = await tx.client.findFirst({ where: { phone, deletedAt: null, id: { not: clientId } }, select: { id: true } });
      const otherUser = await tx.user.findFirst({
        where: { phone, ...(client.userId ? { id: { not: client.userId } } : {}) }, select: { id: true },
      });
      if (otherClient || otherUser) return { error: 'conflict' as const };
      const linked = client.userId ? await tx.user.findUnique({ where: { id: client.userId } }) : null;
      if (client.userId && (!linked || linked.role !== 'CLIENT')) return { error: 'conflict' as const };

      const now = new Date();
      const updated = await tx.client.update({
        where: { id: clientId },
        data: { phone, phoneVerified: now, tokenVersion: { increment: 1 } },
      });
      if (linked) await tx.user.update({ where: { id: linked.id }, data: { phone, phoneVerifiedAt: now } });
      // The number is the login identity: close every other session.
      await tx.clientRefreshToken.updateMany({ where: { clientId, revokedAt: null }, data: { revokedAt: now } });
      await tx.clientPhoneChallenge.updateMany({ where: { clientId, consumedAt: null }, data: { consumedAt: now } });
      const pair = await this.tokens.issueTokenPair(updated, tx);
      return { phone, tokens: { accessToken: pair.accessToken, refreshToken: pair.rawRefresh } };
    }).catch(translateVerifyConflict);

    if ('error' in outcome) throw outcome.error === 'code' ? invalidCode() : detailsUnavailable();
    this.logger.log({ event: 'client_phone.changed', clientId });
    return outcome;
  }
}
