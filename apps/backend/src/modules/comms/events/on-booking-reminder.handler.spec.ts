import { Test } from '@nestjs/testing';

import { OnBookingReminderHandler } from './on-booking-reminder.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';

describe('OnBookingReminderHandler', () => {
  let handler: OnBookingReminderHandler;
  let notify: { execute: jest.Mock };
  let pushTargets: { execute: jest.Mock };

  beforeEach(async () => {
    notify = { execute: jest.fn().mockResolvedValue(undefined) };
    pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: false, tokens: [] }) };
    const module = await Test.createTestingModule({
      providers: [
        OnBookingReminderHandler,
        { provide: SendNotificationHandler, useValue: notify },
        { provide: GetClientPushTargetsHandler, useValue: pushTargets },
      ],
    }).compile();

    handler = module.get(OnBookingReminderHandler);
  });

  const envelope = (extras: Record<string, unknown> = {}) => ({
    payload: {
      bookingId: 'bk-1',
      clientId: 'cl-1',
      scheduledAt: new Date('2026-05-23T10:00:00Z'),
      ...extras,
    },
    source: 'test',
    version: 1,
    occurredAt: new Date(),
    eventId: 'evt-1',
  });

  it('sends in-app + sms when no email provided', async () => {
    await handler.handle(envelope({ clientPhone: '+966500000000' }) as never);
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: ['in-app', 'sms'],
        emailTemplateSlug: undefined,
      }),
    );
  });

  it('adds email channel + slug when clientEmail provided', async () => {
    await handler.handle(
      envelope({
        clientPhone: '+966500000000',
        clientEmail: 'a@b.com',
        clientName: 'سارة',
        serviceName: 'استشارة أسرية',
      }) as never,
    );
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.arrayContaining(['in-app', 'sms', 'email']),
        recipientEmail: 'a@b.com',
        emailTemplateSlug: 'booking-reminder',
        emailVars: expect.objectContaining({
          client_name: 'سارة',
          service_name: 'استشارة أسرية',
        }),
      }),
    );
  });

  it.each(['UTC', 'America/New_York'])(
    'formats Arabic reminder email time in Riyadh when the host defaults to %s',
    async (hostTimeZone) => {
      // Jest config pins TZ to Riyadh; emulate another host default without
      // replacing Intl formatting or overriding an explicit caller timezone.
      const format = Date.prototype.toLocaleTimeString;
      const spy = jest.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(function (this: Date, locales, options) {
        return format.call(this, locales, { timeZone: hostTimeZone, ...options });
      });
      try {
        await handler.handle(envelope({
          scheduledAt: '2026-05-23T22:30:00Z',
          clientEmail: 'client@example.com',
        }) as never);

        expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({
          emailVars: expect.objectContaining({ time: '٠١:٣٠ ص' }),
        }));
      } finally {
        spy.mockRestore();
      }
    },
  );

  it('adds push channel when push tokens present', async () => {
    pushTargets.execute.mockResolvedValueOnce({ pushEnabled: true, tokens: ['tok-1'] });
    await handler.handle(envelope() as never);
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ channels: expect.arrayContaining(['push']) }),
    );
  });

  it('swallows downstream errors', async () => {
    notify.execute.mockRejectedValueOnce(new Error('boom'));
    await expect(handler.handle(envelope() as never)).resolves.toBeUndefined();
  });
});

describe('OnBookingReminderHandler v2 cutover', () => {
  it('uses the reminder source identity and materializes an owned reminder while paused', async () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue('intent-owned') };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(false) };
    const handler = new (OnBookingReminderHandler as any)(notify, pushTargets, ownership, capture, materialize, config);

    await handler.handle({ eventId: 'legacy-reminder-event', occurredAt: new Date(), payload: { bookingId: 'booking-1', clientId: 'client-1', scheduledAt: '2026-09-05T11:00:00.000Z' } });

    expect(materialize.execute).toHaveBeenCalledWith('intent-owned');
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('captures an eligible reminder after cutover and propagates materialization errors', async () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn().mockResolvedValue('intent-new') };
    const materialize = { execute: jest.fn().mockRejectedValue(new Error('reminder materialize failed')) };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnBookingReminderHandler as any)(notify, pushTargets, ownership, capture, materialize, config);

    await expect(handler.handle({ eventId: 'legacy-reminder-event-2', version: 1, occurredAt: new Date(), payload: { bookingId: 'booking-2', clientId: 'client-2', scheduledAt: '2026-09-05T11:00:00.000Z' } })).rejects.toThrow('reminder materialize failed');
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'booking-reminder:booking-2:2026-09-05T11:00:00.000Z:v1', consumerKey: 'comms.booking-reminder-client.v2' }));
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('gates a reminder on scheduledAt minus the configured reminder lead time', async () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn().mockResolvedValue('intent-new') };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const prisma = { organizationSettings: { findFirst: jest.fn().mockResolvedValue({ reminderBeforeMinutes: 120 }) } };
    const handler = new (OnBookingReminderHandler as any)(notify, pushTargets, ownership, capture, materialize, config, prisma);

    await handler.handle({
      eventId: 'legacy-reminder-event-3', version: 1, occurredAt: new Date('2026-09-05T08:00:00.000Z'),
      payload: { bookingId: 'booking-3', clientId: 'client-3', scheduledAt: '2026-09-05T11:00:00.000Z' },
    });

    expect(prisma.organizationSettings.findFirst).toHaveBeenCalledWith({ select: { reminderBeforeMinutes: true } });
    expect(config.shouldCapture).toHaveBeenCalledWith(new Date('2026-09-05T09:00:00.000Z'));
    expect(config.shouldCapture).not.toHaveBeenCalledWith(new Date('2026-09-05T11:00:00.000Z'));
    expect(capture.execute).toHaveBeenCalled();
  });

  it('rejects an unsupported envelope version after ownership miss without legacy fallback', async () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn() };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnBookingReminderHandler as any)(notify, pushTargets, ownership, capture, materialize, config);

    await expect(handler.handle({
      eventId: 'event-unsupported', version: 2, occurredAt: new Date(),
      payload: { bookingId: 'booking-1', clientId: 'client-1', scheduledAt: '2026-09-05T11:00:00.000Z' },
    })).rejects.toThrow(/version/i);
    expect(config.shouldCapture).not.toHaveBeenCalled();
    expect(capture.execute).not.toHaveBeenCalled();
    expect(notify.execute).not.toHaveBeenCalled();
  });
});
