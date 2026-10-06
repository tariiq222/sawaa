import { BadRequestException, Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { normalizeIdentifier } from '../shared/identifier-detector';
import { RequestEmailEntryPhoneDto } from './mobile-email-entry.dto';
import { MobileEmailFlowStore } from './mobile-email-flow.store';
import { MobileEmailIdentity } from './mobile-email-identity';
import { MobileEmailPhoneDispatch } from './mobile-email-phone-dispatch';
import { detailsUnavailable, invalidFlow, translateConflict } from './mobile-email-errors';

@Injectable()
export class RequestEmailEntryPhoneHandler {
  constructor(private readonly store: MobileEmailFlowStore, private readonly identity: MobileEmailIdentity, private readonly dispatch: MobileEmailPhoneDispatch) {}
  async execute(cmd: RequestEmailEntryPhoneDto) {
    const phone = normalizeIdentifier(cmd.phone, 'SMS');
    const result = await this.store.transaction(async tx => {
      const flow = await this.store.lockContinuation(tx, cmd.continuationToken);
      if (!flow || flow.state !== 'DETAILS_PENDING' || flow.phoneMatchAttempts >= 5) return { error: 'flow' as const };
      if (flow.mode === 'LINK_PHONE') {
        if (cmd.firstName !== undefined || cmd.lastName !== undefined || cmd.privacyAccepted !== undefined) throw new BadRequestException({ code: 'invalid_details' });
        const candidate = await this.identity.classify(tx, flow.email);
        if (candidate.kind !== 'link' || candidate.user.id !== flow.boundUserId || candidate.client.id !== flow.boundClientId ||
            !isDeepStrictEqual(this.identity.snapshot(candidate.user, candidate.client), flow.identitySnapshot)) return { error: 'details' as const };
        if (candidate.user.phone !== phone) {
          await tx.mobileEmailFlow.update({ where: { id: flow.id }, data: { phoneMatchAttempts: { increment: 1 } } });
          return { error: 'details' as const };
        }
      } else if (flow.mode === 'REGISTER') {
        if (!cmd.firstName?.trim() || !cmd.lastName?.trim() || cmd.privacyAccepted !== true) throw new BadRequestException({ code: 'invalid_details' });
        if (!await this.identity.contactsFree(tx, flow.email, phone)) return { error: 'details' as const };
      } else return { error: 'flow' as const };
      await tx.mobileEmailFlow.update({ where: { id: flow.id }, data: { phone,
        ...(flow.mode === 'REGISTER' ? { firstName: cmd.firstName!.trim(), lastName: cmd.lastName!.trim(), privacyAcceptedAt: new Date() } : {}),
      } });
      return { id: flow.id };
    }).catch(translateConflict);
    if ('error' in result) throw result.error === 'flow' ? invalidFlow() : detailsUnavailable();
    return this.dispatch.send({ id: result.id, phone, continuationToken: cmd.continuationToken });
  }
}
