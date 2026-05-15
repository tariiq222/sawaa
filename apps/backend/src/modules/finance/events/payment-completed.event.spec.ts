import { PaymentCompletedEvent } from './payment-completed.event';

describe('PaymentCompletedEvent', () => {
  it('should create an instance', () => {
    const event = new PaymentCompletedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
