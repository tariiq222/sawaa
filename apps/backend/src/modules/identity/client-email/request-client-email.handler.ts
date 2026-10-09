import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { ClientEmailStore, maskEmail, sameAddress } from './client-email.store';
import { RequestClientEmailDto } from './client-email.dto';
import { ClientEmailChallengeDto } from './client-email.response';
import { EmailEntryDeliveryError, MobileEmailDelivery } from '../mobile-email-entry/mobile-email-delivery';
import { MobileEmailSendLimiter } from '../mobile-email-entry/mobile-email-send-limiter';

@Injectable()
export class RequestClientEmailHandler {
  constructor(private readonly store: ClientEmailStore, private readonly delivery: MobileEmailDelivery, private readonly limiter: MobileEmailSendLimiter) {}
  async execute(clientId: string, input: RequestClientEmailDto): Promise<ClientEmailChallengeDto> {
    const email = this.store.normalize(input.email);
    // No ownership/availability check here: probing another owner's address must
    // not be distinguishable from probing a free one (no account enumeration).
    await this.store.transaction(async tx => {
      const client = await this.store.owner(tx, clientId);
      if (client.emailVerified !== null && sameAddress(client.email, email)) throw new BadRequestException({ code: 'email_unchanged' });
    });
    // Limit both the destination and the actor, so rotating targets cannot bypass the budget.
    const actorReservation = await this.limiter.reserve('EMAIL', `client-email:${clientId}`);
    let reservation: Awaited<ReturnType<MobileEmailSendLimiter['reserve']>>;
    try { reservation = await this.limiter.reserve('EMAIL', email); }
    catch (error) { await this.limiter.settle(actorReservation, 'rejected'); throw error; }
    const settle = async (outcome: 'accepted' | 'rejected' | 'unknown') => {
      await Promise.all([this.limiter.settle(actorReservation, outcome), this.limiter.settle(reservation, outcome)]);
    };
    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 300000);
    let challenge: { id: string };
    try {
      challenge = await this.store.transaction(async tx => {
        const client = await this.store.owner(tx, clientId);
        if (client.emailVerified !== null && sameAddress(client.email, email)) throw new BadRequestException({ code: 'email_unchanged' });
        // A new request supersedes any previous unconsumed challenge.
        await tx.clientEmailChallenge.updateMany({ where: { clientId, consumedAt: null }, data: { consumedAt: new Date() } });
        const created = await tx.clientEmailChallenge.create({ data: { clientId, email, codeHash, expiresAt } });
        // The pending value never blocks other owners: no unique index, no login use.
        await tx.client.update({ where: { id: clientId }, data: { pendingEmail: email } });
        return created;
      });
    } catch (error) { await settle('rejected'); throw error; }
    try { await this.delivery.send('EMAIL', email, code); }
    catch (error) {
      await this.store.transaction(tx => tx.clientEmailChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } }));
      await settle(error instanceof EmailEntryDeliveryError ? error.outcome : 'unknown');
      throw new ServiceUnavailableException({ code: 'delivery_unavailable' });
    }
    await settle('accepted');
    return { challengeId: challenge.id, maskedEmail: maskEmail(email), expiresIn: 300, retryAfterSeconds: 60 };
  }
}
