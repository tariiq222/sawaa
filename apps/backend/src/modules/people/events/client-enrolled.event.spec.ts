import { ClientEnrolledEvent } from './client-enrolled.event';

describe('ClientEnrolledEvent', () => {
  it('should create an instance', () => {
    const event = new ClientEnrolledEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
