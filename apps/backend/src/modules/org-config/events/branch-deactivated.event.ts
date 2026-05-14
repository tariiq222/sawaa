import { BaseEvent } from '../../../common/events';

export interface BranchDeactivatedPayload {
  branchId: string;
  organizationId: string;
}

export class BranchDeactivatedEvent extends BaseEvent<BranchDeactivatedPayload> {
  readonly eventName = 'org-config.branch.deactivated';

  constructor(payload: BranchDeactivatedPayload) {
    super({ source: 'org-config', version: 1, payload });
  }
}
