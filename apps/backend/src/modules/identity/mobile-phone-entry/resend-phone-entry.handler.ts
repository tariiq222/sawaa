import { Injectable } from '@nestjs/common';
import { MobileEmailSendLimiter } from '../mobile-email-entry/mobile-email-send-limiter';
import { MobileEmailDelivery } from '../mobile-email-entry/mobile-email-delivery';
import { deliveryUnavailable, invalidFlow } from '../mobile-email-entry/mobile-email-errors';
import { MobilePhoneFlowStore, codeHash, newCode } from './mobile-phone-flow.store';
import { ResendPhoneEntryDto } from './mobile-phone-entry.dto';
import { PhoneEntryChallengeDto } from './mobile-phone-entry.response';
import { deliverPhoneEntry } from './phone-entry-dispatch';

@Injectable()
export class ResendPhoneEntryHandler {
  constructor(private readonly store: MobilePhoneFlowStore, private readonly limiter: MobileEmailSendLimiter, private readonly delivery: MobileEmailDelivery) {}

  async execute(cmd: ResendPhoneEntryDto): Promise<PhoneEntryChallengeDto> {
    let reservation: Awaited<ReturnType<MobileEmailSendLimiter['reserve']>> | undefined;
    const code = newCode();
    const hash = await codeHash(code);
    let flow: { id: string; phone: string };
    try {
      // Rotate under the row lock and commit; the old code stops working now.
      flow = await this.store.transaction(async tx => {
        const current = await this.store.lock(tx, cmd.challengeId);
        if (!current || current.state !== 'CODE_PENDING' || !this.store.liveFlow(current)) throw invalidFlow();
        reservation = await this.limiter.reserve('SMS', current.phone);
        await tx.mobilePhoneEntryFlow.update({ where: { id: current.id }, data: {
          codeHash: hash, attempts: 0,
          codeExpiresAt: new Date(Math.min(Date.now() + 300000, current.createdAt.getTime() + 900000)),
        } });
        return { id: current.id, phone: current.phone };
      });
    } catch (error) {
      if (reservation) {
        await this.limiter.settle(reservation, 'rejected');
        throw deliveryUnavailable();
      }
      throw error;
    }
    // Delivered outside the transaction: no row lock is held across the network.
    const outcome = await deliverPhoneEntry(this.store, this.delivery, flow, hash, code);
    await this.limiter.settle(reservation!, outcome);
    if (outcome !== 'accepted') throw deliveryUnavailable();
    return { challengeId: cmd.challengeId, maskedPhone: `${flow.phone.slice(0, 4)}***${flow.phone.slice(-2)}`, expiresIn: 300, retryAfterSeconds: 60 };
  }
}
