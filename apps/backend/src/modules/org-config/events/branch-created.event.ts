import { BaseEvent } from '../../../common/events';

export interface BranchCreatedPayload {
  branchId: string;
  organizationId: string;
}

export class BranchCreatedEvent extends BaseEvent<BranchCreatedPayload> {
  readonly eventName = 'org-config.branch.created';

  constructor(payload: BranchCreatedPayload) {
    super({ source: 'org-config', version: 1, payload });
  }
}
