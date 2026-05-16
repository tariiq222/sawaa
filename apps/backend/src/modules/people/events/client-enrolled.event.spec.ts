import { ClientEnrolledEvent } from './client-enrolled.event';

describe('ClientEnrolledEvent', () => {
  it('should create an instance', () => {
    const event = new ClientEnrolledEvent({} as any);
    expect(event).toBeDefined();
  });
});
