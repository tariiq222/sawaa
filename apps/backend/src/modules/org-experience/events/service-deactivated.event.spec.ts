import { ServiceDeactivatedEvent } from './service-deactivated.event';

describe('ServiceDeactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new ServiceDeactivatedEvent({} as any);
    expect(event).toBeDefined();
  });
});
