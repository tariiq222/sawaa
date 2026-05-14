import { BaseEvent } from '../../../common/events';

export interface ServiceCreatedPayload {
  serviceId: string;
  organizationId: string;
}

export class ServiceCreatedEvent extends BaseEvent<ServiceCreatedPayload> {
  readonly eventName = 'org-experience.service.created';

  constructor(payload: ServiceCreatedPayload) {
    super({ source: 'org-experience', version: 1, payload });
  }
}
