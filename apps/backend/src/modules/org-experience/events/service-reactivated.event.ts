import { BaseEvent } from '../../../common/events';

export interface ServiceReactivatedPayload {
  serviceId: string;
  organizationId: string;
}

export class ServiceReactivatedEvent extends BaseEvent<ServiceReactivatedPayload> {
  readonly eventName = 'org-experience.service.reactivated';

  constructor(payload: ServiceReactivatedPayload) {
    super({ source: 'org-experience', version: 1, payload });
  }
}
