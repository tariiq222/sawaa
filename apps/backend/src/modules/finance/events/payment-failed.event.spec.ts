import { PaymentFailedEvent } from './payment-failed.event';

describe('PaymentFailedEvent', () => {
  it('should create an instance', () => {
    const event = new PaymentFailedEvent({} as any);
    expect(event).toBeDefined();
  });
});
