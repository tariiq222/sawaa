import { ClientCancellationZoomHandler } from './client/client-cancellation-zoom.handler';
import { Test } from '@nestjs/testing';
import { EventBusService } from '../../infrastructure/events';
import { BookingsModule } from './bookings.module';
import { PaymentCompletedEventHandler } from './payment-completed-handler/payment-completed.handler';
import { DepositPaidEventHandler } from './deposit-paid-handler/deposit-paid.handler';
import { RefundCompletedCompatibilityHandler } from './refund-completed-handler/refund-completed.handler';
import { BookingZoomRescheduleHandler } from './zoom-reschedule/booking-zoom-reschedule.handler';
import { BookingZoomCreateRequestedHandler } from './create-zoom-meeting/booking-zoom-create-requested.handler';

describe('BookingsModule', () => {
  it('registers the refund acknowledgement so required outbox delivery has a destination', async () => {
    const eventBus = { subscribe: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        BookingsModule,
        RefundCompletedCompatibilityHandler,
        { provide: EventBusService, useValue: eventBus },
        ...[
          ClientCancellationZoomHandler,
          PaymentCompletedEventHandler,
          DepositPaidEventHandler,
          BookingZoomRescheduleHandler,
          BookingZoomCreateRequestedHandler,
        ].map(provide => ({ provide, useValue: { register: jest.fn() } })),
      ],
    }).compile();

    module.get(BookingsModule).onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'finance.refund.completed',
      'bookings.refund-completed.v1',
      expect.any(Function),
    );
    // The compatibility consumer needs only the event bus, even for historical
    // payloads that do not carry the current appointment/refund fields.
    expect(() => eventBus.subscribe.mock.calls[0][2]({ payload: {} })).not.toThrow();
  });
});
