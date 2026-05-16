import { EmployeeDeactivatedEvent } from './employee-deactivated.event';

describe('EmployeeDeactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new EmployeeDeactivatedEvent({} as any);
    expect(event).toBeDefined();
  });
});
