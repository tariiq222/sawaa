import { BaseEvent } from '../../../common/events';

export interface EmployeeDeactivatedPayload {
  employeeId: string;
  organizationId: string;
}

export class EmployeeDeactivatedEvent extends BaseEvent<EmployeeDeactivatedPayload> {
  readonly eventName = 'people.employee.deactivated';

  constructor(payload: EmployeeDeactivatedPayload) {
    super({ source: 'people', version: 1, payload });
  }
}
