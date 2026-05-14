import { BaseEvent } from '../../../common/events';

export interface EmployeeCreatedPayload {
  employeeId: string;
  organizationId: string;
}

export class EmployeeCreatedEvent extends BaseEvent<EmployeeCreatedPayload> {
  readonly eventName = 'people.employee.created';

  constructor(payload: EmployeeCreatedPayload) {
    super({ source: 'people', version: 1, payload });
  }
}
