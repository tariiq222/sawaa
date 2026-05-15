import { EmployeeReactivatedEvent } from './employee-reactivated.event';

describe('EmployeeReactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new EmployeeReactivatedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
