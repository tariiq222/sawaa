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
