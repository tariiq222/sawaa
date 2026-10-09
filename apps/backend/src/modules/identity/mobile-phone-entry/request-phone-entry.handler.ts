import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizePhone } from '../shared/identifier-detector';
import { MobileEmailSendLimiter } from '../mobile-email-entry/mobile-email-send-limiter';
import { MobileEmailDelivery } from '../mobile-email-entry/mobile-email-delivery';
import { deliveryUnavailable } from '../mobile-email-entry/mobile-email-errors';
import { MobilePhoneFlowStore, codeHash, newCode } from './mobile-phone-flow.store';
import { RequestPhoneEntryDto } from './mobile-phone-entry.dto';
import { PhoneEntryChallengeDto } from './mobile-phone-entry.response';
import { deliverPhoneEntry } from './phone-entry-dispatch';

@Injectable()
export class RequestPhoneEntryHandler {
  constructor(private readonly store: MobilePhoneFlowStore, private readonly limiter: MobileEmailSendLimiter, private readonly delivery: MobileEmailDelivery) {}

  async execute(cmd: RequestPhoneEntryDto): Promise<PhoneEntryChallengeDto> {
    let phone: string;
    try {
      if (typeof cmd.phone !== 'string') throw new Error('invalid_phone');
      phone = normalizePhone(cmd.phone);
    } catch {
      throw new BadRequestException({ code: 'invalid_phone' });
    }
    if (!/^\+9665\d{8}$/.test(phone)) throw new BadRequestException({ code: 'invalid_phone' });
    // No User/Client lookup: every valid phone gets the same send policy.
    const reservation = await this.limiter.reserve('SMS', phone);
    const code = newCode();
    const hash = await codeHash(code);
    let challengeId: string;
    try {
      // Commit first; the SMS is sent outside the transaction.
      const flow = await this.store.transaction(tx => tx.mobilePhoneEntryFlow.create({ data: {
        phone, state: 'CODE_PENDING', codeHash: hash,
        codeExpiresAt: new Date(Date.now() + 300000),
      } }));
      challengeId = flow.id;
    } catch {
      await this.limiter.settle(reservation, 'rejected');
      throw deliveryUnavailable();
    }
    const outcome = await deliverPhoneEntry(this.store, this.delivery, { id: challengeId, phone }, hash, code);
    await this.limiter.settle(reservation, outcome);
    if (outcome !== 'accepted') throw deliveryUnavailable();
    return { challengeId, maskedPhone: `${phone.slice(0, 4)}***${phone.slice(-2)}`, expiresIn: 300, retryAfterSeconds: 60 };
  }
}
