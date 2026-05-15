import { Test } from '@nestjs/testing';
import * as Sentry from '@sentry/node';
import { EventBusService } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';
import { OnBookingCancelledHandler } from './on-booking-cancelled.handler';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

describe('OnBookingCancelledHandler', () => {
  let handler: OnBookingCancelledHandler;
  let notify: any;
  let pushTargets: any;
  let eventBus: any;

  beforeEach(async () => {
    notify = { execute: jest.fn() };
    pushTargets = { execute: jest.fn() };
    eventBus = { subscribe: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        OnBookingCancelledHandler,
        { provide: SendNotificationHandler, useValue: notify },
        { provide: GetClientPushTargetsHandler, useValue: pushTargets },
      ],
    }).compile();

    handler = module.get(OnBookingCancelledHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should subscribe on register', () => {
    handler.register(eventBus as any);
    expect(eventBus.subscribe).toHaveBeenCalledWith('bookings.booking.cancelled', expect.any(Function));
  });

  it('should send notification without push when disabled', async () => {
    pushTargets.execute.mockResolvedValue({ pushEnabled: false, tokens: [] });
    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', reason: 'sick', clientEmail: 'a@b.com', clientName: 'John' } } as any);
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({ channels: ['in-app', 'email'] }));
  });

  it('should add push channel when enabled with tokens', async () => {
    pushTargets.execute.mockResolvedValue({ pushEnabled: true, tokens: ['tok1'] });
    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', reason: 'sick' } } as any);
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({ channels: ['in-app', 'email', 'push'], fcmTokens: ['tok1'] }));
  });

  it('should not add push when tokens empty', async () => {
    pushTargets.execute.mockResolvedValue({ pushEnabled: true, tokens: [] });
    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', reason: 'sick' } } as any);
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({ channels: ['in-app', 'email'] }));
  });

  it('should capture exception on error', async () => {
    pushTargets.execute.mockRejectedValue(new Error('fail'));
    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', reason: 'sick' } } as any);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ tags: { event: 'bookings.booking.cancelled', bookingId: 'b1' } }));
  });
});
