import { BaseEvent } from '../../../common/events';

export interface EmployeeReactivatedPayload {
  employeeId: string;
  organizationId: string;
}

export class EmployeeReactivatedEvent extends BaseEvent<EmployeeReactivatedPayload> {
  readonly eventName = 'people.employee.reactivated';

  constructor(payload: EmployeeReactivatedPayload) {
    super({ source: 'people', version: 1, payload });
  }
}
