import { PaymentFailedEvent } from './payment-failed.event';

describe('PaymentFailedEvent', () => {
  it('should create an instance', () => {
    const event = new PaymentFailedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
