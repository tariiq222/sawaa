import { ServiceReactivatedEvent } from './service-reactivated.event';

describe('ServiceReactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new ServiceReactivatedEvent({} as any);
    expect(event).toBeDefined();
  });
});
