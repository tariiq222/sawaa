import { EmployeeCreatedEvent } from './employee-created.event';

describe('EmployeeCreatedEvent', () => {
  it('should create an instance', () => {
    const event = new EmployeeCreatedEvent({} as any);
    expect(event).toBeDefined();
  });
});
