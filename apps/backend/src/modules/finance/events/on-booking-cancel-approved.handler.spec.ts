import { Test } from '@nestjs/testing';
import { OnBookingCancelApprovedRefundHandler } from './on-booking-cancel-approved.handler';
import { RefundPaymentHandler } from '../refund-payment/refund-payment.handler';
import { EventBusService } from '../../../infrastructure/events';

describe('OnBookingCancelApprovedRefundHandler', () => {
  let handler: OnBookingCancelApprovedRefundHandler;
  let refund: { finalizeRefundFromCancellation: jest.Mock };
  let eventBus: { subscribe: jest.Mock };

  beforeEach(async () => {
    refund = { finalizeRefundFromCancellation: jest.fn().mockResolvedValue(undefined) };
    eventBus = { subscribe: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        OnBookingCancelApprovedRefundHandler,
        { provide: RefundPaymentHandler, useValue: refund },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();
    handler = module.get(OnBookingCancelApprovedRefundHandler);
  });

  it('subscribes to bookings.booking.cancel_approved on register()', () => {
    handler.register();
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'bookings.booking.cancel_approved',
      expect.any(Function),
    );
  });

  it('P0: finalizes the pre-created refund (calls Moyasar via finalizeRefundFromCancellation)', async () => {
    await handler.handle({
      payload: {
        bookingId: 'b1',
        clientId: 'c1',
        employeeId: 'e1',
        autoRefund: true,
        refundRequestId: 'rr-1',
        idempotencyKey: 'refund:rr-1',
        paymentId: 'pay-1',
      },
    } as any);

    expect(refund.finalizeRefundFromCancellation).toHaveBeenCalledWith({
      refundRequestId: 'rr-1',
      idempotencyKey: 'refund:rr-1',
    });
  });

  it('skips when no refundRequestId was created (no refund to settle)', async () => {
    await handler.handle({
      payload: {
        bookingId: 'b1',
        clientId: 'c1',
        employeeId: 'e1',
        autoRefund: false,
        refundRequestId: null,
        idempotencyKey: null,
        paymentId: null,
      },
    } as any);

    expect(refund.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });

  it('does not throw when finalize fails (logs only)', async () => {
    refund.finalizeRefundFromCancellation.mockRejectedValueOnce(new Error('moyasar 502'));
    await expect(
      handler.handle({
        payload: {
          bookingId: 'b1',
          clientId: 'c1',
          employeeId: 'e1',
          autoRefund: true,
          refundRequestId: 'rr-1',
          idempotencyKey: 'refund:rr-1',
          paymentId: 'pay-1',
        },
      } as any),
    ).resolves.toBeUndefined();
  });
});
