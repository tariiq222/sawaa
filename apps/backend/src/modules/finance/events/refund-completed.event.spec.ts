import { RefundCompletedEvent } from './refund-completed.event';

describe('RefundCompletedEvent', () => {
  it('should create an instance', () => {
    const event = new RefundCompletedEvent({} as any);
    expect(event).toBeDefined();
  });
});
