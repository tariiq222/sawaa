import { DepositPaidEvent } from './deposit-paid.event';

describe('DepositPaidEvent', () => {
  it('uses the finance.payment.deposit_paid event name', () => {
    const event = new DepositPaidEvent({
      paymentId: 'pay-1',
      invoiceId: 'inv-1',
      bookingId: 'book-1',
      amount: 5000,
      currency: 'SAR',
      organizationId: 'org-1',
    });
    expect(event.eventName).toBe('finance.payment.deposit_paid');
  });

  it('carries the payload through toEnvelope', () => {
    const event = new DepositPaidEvent({
      paymentId: 'pay-1',
      invoiceId: 'inv-1',
      bookingId: 'book-1',
      amount: 5000,
      currency: 'SAR',
    });
    const envelope = event.toEnvelope();
    expect(envelope.payload).toEqual(
      expect.objectContaining({ paymentId: 'pay-1', bookingId: 'book-1', amount: 5000 }),
    );
  });
});
