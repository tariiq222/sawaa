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
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'bookings.booking.cancelled', 'comms.booking-cancelled-notify.v1', expect.any(Function),
    );
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

  it('uses appointment terminology in client cancellation notifications', async () => {
    pushTargets.execute.mockResolvedValue({ pushEnabled: true, tokens: ['tok1'] });

    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', reason: 'OTHER' } } as any);

    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({
      title: 'تم إلغاء الموعد',
      body: 'نأسف، تم إلغاء موعدك.',
      channels: ['in-app', 'email', 'push'],
    }));
  });

  it('should capture exception on error', async () => {
    pushTargets.execute.mockRejectedValue(new Error('fail'));
    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', reason: 'sick' } } as any);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ tags: { event: 'bookings.booking.cancelled', bookingId: 'b1' } }));
  });
});

describe('OnBookingCancelledHandler v2 cutover', () => {
  it('uses ownership before the cutoff gate and never falls back to legacy sending', async () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue('intent-owned') };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(false) };
    const handler = new (OnBookingCancelledHandler as any)(notify, pushTargets, ownership, capture, materialize, config);

    await handler.handle({ eventId: 'event-cancelled-1', occurredAt: new Date(), payload: { bookingId: 'booking-1', clientId: 'client-1', employeeId: 'employee-1', reason: 'OTHER' } });

    expect(materialize.execute).toHaveBeenCalledWith('intent-owned');
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('captures the client cancellation after cutover and propagates materialization failure', async () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn().mockResolvedValue('intent-new') };
    const materialize = { execute: jest.fn().mockRejectedValue(new Error('v2 failed')) };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnBookingCancelledHandler as any)(notify, pushTargets, ownership, capture, materialize, config);

    await expect(handler.handle({ eventId: 'event-cancelled-2', version: 1, occurredAt: new Date(), payload: { bookingId: 'booking-2', clientId: 'client-2', employeeId: 'employee-2', reason: 'CLIENT_REQUESTED' } })).rejects.toThrow('v2 failed');
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'domain-event:event-cancelled-2', consumerKey: 'comms.booking-cancelled-client.v2' }));
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('rejects an unsupported envelope version after ownership miss without legacy fallback', async () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn() };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnBookingCancelledHandler as any)(notify, pushTargets, ownership, capture, materialize, config);

    await expect(handler.handle({
      eventId: 'event-unsupported', version: 2, occurredAt: new Date(),
      payload: { bookingId: 'booking-1', clientId: 'client-1', employeeId: 'employee-1', reason: 'OTHER' },
    })).rejects.toThrow(/version/i);
    expect(config.shouldCapture).not.toHaveBeenCalled();
    expect(capture.execute).not.toHaveBeenCalled();
    expect(notify.execute).not.toHaveBeenCalled();
  });
});
