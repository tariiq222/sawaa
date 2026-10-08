import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MobileEmailFlowStore, codeHash, hashContinuation, newCode, newContinuation } from './mobile-email-flow.store';
import { MobileEmailSendLimiter } from './mobile-email-send-limiter';
import { EmailEntryDeliveryError, MobileEmailDelivery } from './mobile-email-delivery';
import { deliveryUnavailable, invalidFlow } from './mobile-email-errors';
import { EmailEntryPhoneChallengeDto } from './mobile-email-entry.response';

@Injectable()
export class MobileEmailPhoneDispatch {
  constructor(private readonly store: MobileEmailFlowStore, private readonly limiter: MobileEmailSendLimiter, private readonly delivery: MobileEmailDelivery) {}
  async send(input: { id: string; continuationToken: string; phone: string; phoneChallengeId?: string }): Promise<EmailEntryPhoneChallengeDto> {
    const reservation = await this.limiter.reserve('SMS', input.phone);
    const code = newCode();
    const hash = await codeHash(code);
    const phoneChallengeId = randomUUID();
    const continuationToken = newContinuation();
    let phoneExpiresAt: Date;
    try {
      phoneExpiresAt = await this.store.transaction(async tx => {
        const flow = await this.store.lockContinuation(tx, input.continuationToken);
        if (!flow || flow.id !== input.id || flow.phone !== input.phone || !flow.continuationExpiresAt ||
            (input.phoneChallengeId ? flow.state !== 'PHONE_PENDING' || flow.phoneChallengeId !== input.phoneChallengeId : flow.state !== 'DETAILS_PENDING')) throw invalidFlow();
        const expiry = new Date(Math.min(Date.now() + 300000, flow.continuationExpiresAt.getTime(), flow.createdAt.getTime() + 900000));
        await tx.mobileEmailFlow.update({ where: { id: flow.id }, data: { state: 'PHONE_SENDING', phoneChallengeId, phoneCodeHash: hash, phoneExpiresAt: expiry, phoneAttempts: 0 } });
        return expiry;
      });
    } catch (error) {
      await this.limiter.settle(reservation, 'rejected');
      throw error;
    }
    try { await this.delivery.send('SMS', input.phone, code); }
    catch (error) {
      await this.store.settlePhone(input.id, phoneChallengeId, false);
      await this.limiter.settle(reservation, error instanceof EmailEntryDeliveryError ? error.outcome : 'unknown');
      throw deliveryUnavailable();
    }
    await this.limiter.settle(reservation, 'accepted');
    if (!await this.store.settlePhone(input.id, phoneChallengeId, true, hashContinuation(continuationToken))) throw deliveryUnavailable();
    return { phoneChallengeId, continuationToken, maskedPhone: `${input.phone.slice(0, 4)}***${input.phone.slice(-2)}`, expiresIn: Math.max(0, Math.floor((phoneExpiresAt.getTime() - Date.now()) / 1000)), retryAfterSeconds: 60 };
  }
}
