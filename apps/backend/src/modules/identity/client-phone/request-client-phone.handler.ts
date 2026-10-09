import { BadRequestException, Injectable } from '@nestjs/common';
import { MobileEmailSendLimiter } from '../mobile-email-entry/mobile-email-send-limiter';
import { EmailEntryDeliveryError, MobileEmailDelivery } from '../mobile-email-entry/mobile-email-delivery';
import { deliveryUnavailable } from '../mobile-email-entry/mobile-email-errors';
import { codeHash, newCode } from '../mobile-email-entry/mobile-email-flow.store';
import { ClientPhoneStore, maskPhone } from './client-phone.store';
import { RequestClientPhoneDto, SAUDI_MOBILE } from './client-phone.dto';
import { ClientPhoneChallengeDto } from './client-phone.response';

type Outcome = 'accepted' | 'rejected' | 'unknown';

@Injectable()
export class RequestClientPhoneHandler {
  constructor(private readonly store: ClientPhoneStore, private readonly limiter: MobileEmailSendLimiter, private readonly delivery: MobileEmailDelivery) {}

  async execute(clientId: string, input: RequestClientPhoneDto): Promise<ClientPhoneChallengeDto> {
    const phone = input.phone;
    if (typeof phone !== 'string' || !SAUDI_MOBILE.test(phone)) throw new BadRequestException({ code: 'invalid_phone' });
    // No ownership/availability lookup: probing a number held by someone else
    // must look exactly like probing a free one. Ownership is decided at verify.
    await this.store.transaction(async tx => {
      const client = await this.store.owner(tx, clientId);
      if (client.phone === phone) throw new BadRequestException({ code: 'phone_unchanged' });
    });
    // Budget both the destination and the actor so rotating numbers cannot bypass it.
    const actor = await this.limiter.reserve('SMS', `client-phone:${clientId}`);
    let target: Awaited<ReturnType<MobileEmailSendLimiter['reserve']>>;
    try { target = await this.limiter.reserve('SMS', phone); }
    catch (error) { await this.limiter.settle(actor, 'rejected'); throw error; }
    const settle = (outcome: Outcome) => Promise.all([this.limiter.settle(actor, outcome), this.limiter.settle(target, outcome)]);

    const code = newCode();
    const hash = await codeHash(code);
    let challengeId: string;
    try {
      challengeId = await this.store.transaction(async tx => {
        const client = await this.store.owner(tx, clientId);
        if (client.phone === phone) throw new BadRequestException({ code: 'phone_unchanged' });
        await tx.clientPhoneChallenge.updateMany({ where: { clientId, consumedAt: null }, data: { consumedAt: new Date() } });
        const created = await tx.clientPhoneChallenge.create({ data: { clientId, phone, codeHash: hash, expiresAt: new Date(Date.now() + 300000) } });
        return created.id;
      });
    } catch (error) {
      await settle('rejected');
      throw error;
    }
    // Delivered after commit: no row lock or pooled connection is held across the network.
    try {
      await this.delivery.send('SMS', phone, code);
    } catch (error) {
      await this.store.transaction(tx => tx.clientPhoneChallenge.updateMany({ where: { id: challengeId, consumedAt: null }, data: { consumedAt: new Date() } }))
        .catch(() => undefined);
      await settle(error instanceof EmailEntryDeliveryError ? error.outcome : 'unknown');
      throw deliveryUnavailable();
    }
    await settle('accepted');
    return { challengeId, maskedPhone: maskPhone(phone), expiresIn: 300, retryAfterSeconds: 60 };
  }
}
