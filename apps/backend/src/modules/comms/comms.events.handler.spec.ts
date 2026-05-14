import { OnBookingCancelledHandler } from './events/on-booking-cancelled.handler';
import { OnBookingReminderHandler } from './events/on-booking-reminder.handler';
import { OnPaymentFailedHandler } from './events/on-payment-failed.handler';
import { OnClientEnrolledHandler } from './events/on-client-enrolled.handler';
import type { SendNotificationHandler } from './send-notification/send-notification.handler';
import type { GetClientPushTargetsHandler } from './fcm-tokens/get-client-push-targets.handler';
import type { EventBusService } from '../../infrastructure/events';

const buildNotifyHandler = () => ({ execute: jest.fn().mockResolvedValue(undefined) });
const buildPushTargets = (
  result: { pushEnabled: boolean; tokens: string[] } = { pushEnabled: true, tokens: ['tok-1'] },
) => ({ execute: jest.fn().mockResolvedValue(result) });

const buildEventBus = () => {
  const subscribers = new Map<string, (e: unknown) => Promise<void>>();
  return {
    subscribe: jest.fn((event: string, cb: (e: unknown) => Promise<void>) => { subscribers.set(event, cb); }),
    getSubscriber: (event: string) => subscribers.get(event)!,
  };
};

describe('OnBookingCancelledHandler', () => {
  it('calls SendNotificationHandler with push + email + in-app channels when pushEnabled', async () => {
    const notify = buildNotifyHandler();
    const pushTargets = buildPushTargets();
    const handler = new OnBookingCancelledHandler(
      notify as unknown as SendNotificationHandler,
      pushTargets as unknown as GetClientPushTargetsHandler,
    );
    await handler.handle({
      eventId: 'e-1', correlationId: 'c-1', source: 'bookings', version: 1,
      occurredAt: new Date(),
      payload: {
        bookingId: 'book-1', clientId: 'client-1',
        employeeId: 'emp-1', reason: 'CLIENT_REQUEST',
        clientEmail: 'client@example.com', clientName: 'أحمد', clientPhone: '+966500000000',
      },
    });
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.arrayContaining(['push', 'email', 'in-app']),
        fcmTokens: ['tok-1'],
      }),
    );
  });

  it('omits push channel when pushEnabled=false', async () => {
    const notify = buildNotifyHandler();
    const pushTargets = buildPushTargets({ pushEnabled: false, tokens: [] });
    const handler = new OnBookingCancelledHandler(
      notify as unknown as SendNotificationHandler,
      pushTargets as unknown as GetClientPushTargetsHandler,
    );
    await handler.handle({
      eventId: 'e-1', correlationId: 'c-1', source: 'bookings', version: 1,
      occurredAt: new Date(),
      payload: {
        bookingId: 'book-1', clientId: 'client-1',
        employeeId: 'emp-1', reason: 'CLIENT_REQUEST',
      },
    });
    const call = notify.execute.mock.calls[0][0] as { channels: string[] };
    expect(call.channels).not.toContain('push');
  });
});

describe('OnBookingReminderHandler', () => {
  it('calls SendNotificationHandler with push + sms + in-app channels when pushEnabled', async () => {
    const notify = buildNotifyHandler();
    const pushTargets = buildPushTargets();
    const handler = new OnBookingReminderHandler(
      notify as unknown as SendNotificationHandler,
      pushTargets as unknown as GetClientPushTargetsHandler,
    );
    await handler.handle({
      eventId: 'e-2', correlationId: 'c-2', source: 'ops', version: 1,
      occurredAt: new Date(),
      payload: {
        bookingId: 'book-1', clientId: 'client-1',
        scheduledAt: new Date(), clientPhone: '+966500000000',
      },
    });
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.arrayContaining(['push', 'sms', 'in-app']),
        fcmTokens: ['tok-1'],
      }),
    );
  });

  it('registers subscriber on ops.booking.reminder_due', () => {
    const notify = buildNotifyHandler();
    const eb = buildEventBus();
    const pushTargets = buildPushTargets();
    const handler = new OnBookingReminderHandler(
      notify as unknown as SendNotificationHandler,
      pushTargets as unknown as GetClientPushTargetsHandler,
    );
    handler.register(eb as unknown as EventBusService);
    expect(eb.subscribe).toHaveBeenCalledWith('ops.booking.reminder_due', expect.any(Function));
  });

  it('sends push notification with booking time', async () => {
    const notify = buildNotifyHandler();
    const eb = buildEventBus();
    const pushTargets = buildPushTargets();
    const handler = new OnBookingReminderHandler(
      notify as unknown as SendNotificationHandler,
      pushTargets as unknown as GetClientPushTargetsHandler,
    );
    handler.register(eb as unknown as EventBusService);

    await eb.getSubscriber('ops.booking.reminder_due')({
      payload: {
        bookingId: 'b-1', clientId: 'c-1',
        scheduledAt: '2026-06-01T10:00:00Z',
      },
    });

    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: 'c-1' }),
    );
  });

  it('handles error gracefully without throwing', async () => {
    const notify = buildNotifyHandler();
    notify.execute = jest.fn().mockRejectedValue(new Error('push failed'));
    const eb = buildEventBus();
    const pushTargets = buildPushTargets();
    const handler = new OnBookingReminderHandler(
      notify as unknown as SendNotificationHandler,
      pushTargets as unknown as GetClientPushTargetsHandler,
    );
    handler.register(eb as unknown as EventBusService);

    await expect(
      eb.getSubscriber('ops.booking.reminder_due')({
        payload: { bookingId: 'b-1', clientId: 'c-1', scheduledAt: new Date() },
      }),
    ).resolves.not.toThrow();
  });
});

describe('OnPaymentFailedHandler', () => {
  it('calls SendNotificationHandler with push + email + in-app channels when pushEnabled', async () => {
    const notify = buildNotifyHandler();
    const pushTargets = buildPushTargets();
    const handler = new OnPaymentFailedHandler(
      notify as unknown as SendNotificationHandler,
      pushTargets as unknown as GetClientPushTargetsHandler,
    );
    await handler.handle({
      eventId: 'e-3', correlationId: 'c-3', source: 'finance', version: 1,
      occurredAt: new Date(),
      payload: {
        paymentId: 'pay-1', clientId: 'client-1',
        amount: 200, currency: 'SAR', clientEmail: 'client@example.com',
        clientName: 'أحمد',
      },
    });
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.arrayContaining(['push', 'email', 'in-app']),
        fcmTokens: ['tok-1'],
      }),
    );
  });
});

describe('OnClientEnrolledHandler', () => {
  it('calls SendNotificationHandler with email + in-app channels', async () => {
    const notify = buildNotifyHandler();
    const handler = new OnClientEnrolledHandler(notify as unknown as SendNotificationHandler);
    await handler.handle({
      eventId: 'e-4', correlationId: 'c-4', source: 'people', version: 1,
      occurredAt: new Date(),
      payload: {
        clientId: 'client-1', name: 'أحمد',
        email: 'client@example.com', phone: '+966500000000',
      },
    });
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ channels: expect.arrayContaining(['email', 'in-app']) }),
    );
  });
});
