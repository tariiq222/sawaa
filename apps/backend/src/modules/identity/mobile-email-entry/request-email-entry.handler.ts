import { MobileEmailFlow } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { normalizeIdentifier } from '../shared/identifier-detector';
import { RequestEmailEntryDto } from './mobile-email-entry.dto';
import { EmailEntryChallengeDto } from './mobile-email-entry.response';
import { MobileEmailFlowStore, codeHash, newCode } from './mobile-email-flow.store';
import { MobileEmailSendLimiter } from './mobile-email-send-limiter';
import { EmailEntryDeliveryError, MobileEmailDelivery } from './mobile-email-delivery';
import { deliveryUnavailable } from './mobile-email-errors';

@Injectable()
export class RequestEmailEntryHandler {
  constructor(private readonly prisma: PrismaService, private readonly store: MobileEmailFlowStore, private readonly limiter: MobileEmailSendLimiter, private readonly delivery: MobileEmailDelivery) {}
  async execute(cmd: RequestEmailEntryDto): Promise<EmailEntryChallengeDto> {
    const email = normalizeIdentifier(cmd.email, 'EMAIL');
    const reservation = await this.limiter.reserve('EMAIL', email);
    const code = newCode();
    let flow: MobileEmailFlow;
    try {
      flow = await this.prisma.mobileEmailFlow.create({ data: { email, state: 'EMAIL_SENDING', emailCodeHash: await codeHash(code), emailExpiresAt: new Date(Date.now() + 300000) } });
    } catch {
      await this.limiter.settle(reservation, 'rejected');
      throw deliveryUnavailable();
    }
    try {
      await this.delivery.send('EMAIL', email, code);
    } catch (error) {
      await this.store.settleEmail(flow.id, false);
      await this.limiter.settle(reservation, error instanceof EmailEntryDeliveryError ? error.outcome : 'unknown');
      throw deliveryUnavailable();
    }
    await this.limiter.settle(reservation, 'accepted');
    if (!await this.store.settleEmail(flow.id, true)) throw deliveryUnavailable();
    return { challengeId: flow.id, maskedEmail: `${email[0]}***@${email.split('@')[1]}`, expiresIn: 300, retryAfterSeconds: 60 };
  }
}
