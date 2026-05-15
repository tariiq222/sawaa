import { EmployeeDeactivatedEvent } from './employee-deactivated.event';

describe('EmployeeDeactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new EmployeeDeactivatedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
