import { ServiceDeactivatedEvent } from './service-deactivated.event';

describe('ServiceDeactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new ServiceDeactivatedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
