import { Injectable } from '@nestjs/common';
import { MobileEmailFlowStore } from './mobile-email-flow.store';
import { MobileEmailPhoneDispatch } from './mobile-email-phone-dispatch';
import { ResendEmailEntryPhoneDto } from './mobile-email-entry.dto';
import { invalidFlow } from './mobile-email-errors';

@Injectable()
export class ResendEmailEntryPhoneHandler {
  constructor(private readonly store: MobileEmailFlowStore, private readonly dispatch: MobileEmailPhoneDispatch) {}
  async execute(cmd: ResendEmailEntryPhoneDto) {
    const flow = await this.store.transaction(tx => this.store.lockContinuation(tx, cmd.continuationToken));
    if (!flow || flow.state !== 'PHONE_PENDING' || flow.phoneChallengeId !== cmd.phoneChallengeId || !flow.phone) throw invalidFlow();
    return this.dispatch.send({ id: flow.id, phone: flow.phone, continuationToken: cmd.continuationToken, phoneChallengeId: cmd.phoneChallengeId });
  }
}
