import { Test } from '@nestjs/testing';
import { OnBookingCancelApprovedRefundHandler } from './on-booking-cancel-approved.handler';
import { RefundPaymentHandler } from '../refund-payment/refund-payment.handler';
import { CancellationRefundIntentService } from '../cancellation-refund/cancellation-refund-intent.service';
import { EventBusService } from '../../../infrastructure/events';

describe('OnBookingCancelApprovedRefundHandler', () => {
  let handler: OnBookingCancelApprovedRefundHandler;
  let refund: { finalizeRefundFromCancellation: jest.Mock };
  let intents: { execute: jest.Mock };
  let eventBus: { subscribe: jest.Mock };

  beforeEach(async () => {
    refund = { finalizeRefundFromCancellation: jest.fn().mockResolvedValue(undefined) };
    intents = { execute: jest.fn().mockResolvedValue(undefined) };
    eventBus = { subscribe: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        OnBookingCancelApprovedRefundHandler,
        { provide: CancellationRefundIntentService, useValue: intents },
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
      'finance.booking-cancel-approved-refund',
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

  it('rethrows finalize failures so BullMQ retries the consumer job', async () => {
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
    ).rejects.toThrow('moyasar 502');
  });
  it('executes staff intents with the event identity and does not also finalize the legacy field', async () => {
    const staffCancellation = { version: 1, initiatedBy: 'STAFF', reason: 'Approved', performedBy: 'staff', refund: {}, allocations: [] };
    const envelope = { eventId: 'event-1', payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', autoRefund: true,
      staffCancellation, refundRequestId: 'old', idempotencyKey: 'old' } };
    await handler.handle(envelope as any);
    await handler.handle(envelope as any);
    expect(intents.execute).toHaveBeenNthCalledWith(1, 'event-1', 'b1', 'c1', staffCancellation);
    expect(intents.execute).toHaveBeenNthCalledWith(2, 'event-1', 'b1', 'c1', staffCancellation);
    expect(refund.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });

});
