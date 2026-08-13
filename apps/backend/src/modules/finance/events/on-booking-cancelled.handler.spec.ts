import { Test } from '@nestjs/testing';
import { OnBookingCancelledRefundHandler } from './on-booking-cancelled.handler';
import { RefundPaymentHandler } from '../refund-payment/refund-payment.handler';
import { EventBusService } from '../../../infrastructure/events';

describe('OnBookingCancelledRefundHandler', () => {
  let handler: OnBookingCancelledRefundHandler;
  let refund: { execute: jest.Mock; finalizeRefundFromCancellation: jest.Mock };
  let eventBus: { subscribe: jest.Mock };

  beforeEach(async () => {
    refund = {
      execute: jest.fn().mockResolvedValue({}),
      finalizeRefundFromCancellation: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { subscribe: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        OnBookingCancelledRefundHandler,
        { provide: RefundPaymentHandler, useValue: refund },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();
    handler = module.get(OnBookingCancelledRefundHandler);
  });

  it('triggers refund when refundType=FULL and paymentId present', async () => {
    await handler.handle({
      payload: { refundType: 'FULL', paymentId: 'pay_1', bookingId: 'b', organizationId: 'o', clientId: 'c', cancelledBy: 'u' },
    } as any);
    expect(refund.execute).toHaveBeenCalledWith({
      paymentId: 'pay_1',
      reason: expect.stringContaining('cancellation'),
      performedBy: 'c',
    });
  });

  it('triggers refund when refundType=PARTIAL and paymentId present', async () => {
    await handler.handle({
      payload: { refundType: 'PARTIAL', paymentId: 'pay_2', bookingId: 'b2', organizationId: 'o', clientId: 'c2' },
    } as any);
    expect(refund.execute).toHaveBeenCalledWith({
      paymentId: 'pay_2',
      reason: expect.stringContaining('cancellation'),
      performedBy: 'c2',
    });
  });

  it('skips refund when refundType=NONE', async () => {
    await handler.handle({
      payload: { refundType: 'NONE', paymentId: 'pay_1', bookingId: 'b', organizationId: 'o', clientId: 'c' },
    } as any);
    expect(refund.execute).not.toHaveBeenCalled();
  });

  it('skips refund when paymentId is null', async () => {
    await handler.handle({
      payload: { refundType: 'FULL', paymentId: null, bookingId: 'b', organizationId: 'o', clientId: 'c' },
    } as any);
    expect(refund.execute).not.toHaveBeenCalled();
  });

  it('rethrows refund failures so BullMQ retries the consumer job', async () => {
    refund.execute.mockRejectedValueOnce(new Error('moyasar 502'));
    await expect(
      handler.handle({
        payload: { refundType: 'FULL', paymentId: 'pay_1', bookingId: 'b', organizationId: 'o', clientId: 'c' },
      } as any),
    ).rejects.toThrow('moyasar 502');
  });

  it('passes stable event identity to the durable pre-created refund', async () => {
    await handler.handle({
      eventId: '11111111-1111-4111-8111-111111111111',
      payload: {
        refundType: 'FULL', paymentId: 'pay-1', bookingId: 'b', clientId: 'c',
        refundRequestId: 'rr-1', idempotencyKey: 'refund:rr-1',
      },
    } as any);

    expect(refund.finalizeRefundFromCancellation).toHaveBeenCalledWith({
      refundRequestId: 'rr-1',
      idempotencyKey: 'refund:rr-1',
      sourceEventId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('calls register() which subscribes to the event bus', () => {
    handler.register();
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'bookings.booking.cancelled',
      'finance.booking-cancelled-refund',
      expect.any(Function),
    );
  });
});
