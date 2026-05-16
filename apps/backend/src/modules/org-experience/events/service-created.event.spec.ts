import { ServiceCreatedEvent } from './service-created.event';

describe('ServiceCreatedEvent', () => {
  it('should create an instance', () => {
    const event = new ServiceCreatedEvent({} as any);
    expect(event).toBeDefined();
  });
});
