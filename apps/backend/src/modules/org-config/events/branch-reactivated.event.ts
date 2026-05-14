import { BaseEvent } from '../../../common/events';

export interface BranchReactivatedPayload {
  branchId: string;
  organizationId: string;
}

export class BranchReactivatedEvent extends BaseEvent<BranchReactivatedPayload> {
  readonly eventName = 'org-config.branch.reactivated';

  constructor(payload: BranchReactivatedPayload) {
    super({ source: 'org-config', version: 1, payload });
  }
}
