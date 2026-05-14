import { BaseEvent } from '../../../common/events';

export interface ServiceDeactivatedPayload {
  serviceId: string;
  organizationId: string;
}

export class ServiceDeactivatedEvent extends BaseEvent<ServiceDeactivatedPayload> {
  readonly eventName = 'org-experience.service.deactivated';

  constructor(payload: ServiceDeactivatedPayload) {
    super({ source: 'org-experience', version: 1, payload });
  }
}
