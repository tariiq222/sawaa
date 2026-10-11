import { Test } from '@nestjs/testing';
import { ResilientNotificationDispatcher, NOTIFICATION_RETRY_QUEUE } from './resilient-notification-dispatcher.service';
import { PrismaService } from '../../../infrastructure/database';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { SendEmailHandler } from '../send-email/send-email.handler';
import { SendSmsHandler } from '../send-sms/send-sms.handler';
import { SendPushHandler } from '../send-push/send-push.handler';
import type { FcmService } from '../../../infrastructure/mail';

describe('ResilientNotificationDispatcher', () => {
  let service: ResilientNotificationDispatcher;
  let prisma: { notificationDeliveryLog: { create: jest.Mock; update: jest.Mock } };
  let bullmq: { getQueue: jest.Mock };
  let email: { execute: jest.Mock };
  let sms: { execute: jest.Mock };
  let push: { execute: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    prisma = {
      notificationDeliveryLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    bullmq = { getQueue: jest.fn().mockReturnValue(queue) };
    email = { execute: jest.fn().mockResolvedValue({ sent: true }) };
    sms = { execute: jest.fn().mockResolvedValue({ sent: true }) };
    push = { execute: jest.fn().mockResolvedValue({ sent: true }) };

    const module = await Test.createTestingModule({
      providers: [
        ResilientNotificationDispatcher,
        { provide: PrismaService, useValue: prisma },
        { provide: BullMqService, useValue: bullmq },
        { provide: SendEmailHandler, useValue: email },
        { provide: SendSmsHandler, useValue: sms },
        { provide: SendPushHandler, useValue: push },
      ],
    }).compile();

    service = module.get(ResilientNotificationDispatcher);
  });

  const basePayload = {
    organizationId: 'org-1',
    recipientId: 'user-1',
    type: 'BOOKING_CONFIRMED' as const,
  };

  // ── dispatch ───────────────────────────────────────────────────────────

  it('dispatches multiple channels', async () => {
    await service.dispatch(basePayload, ['email', 'sms']);
    expect(prisma.notificationDeliveryLog.create).toHaveBeenCalledTimes(2);
  });

  it('dispatches single channel', async () => {
    await service.dispatch(basePayload, ['email']);
    expect(prisma.notificationDeliveryLog.create).toHaveBeenCalledTimes(1);
  });

  // ── attemptSend success paths ──────────────────────────────────────────

  it('records SKIPPED (not SENT) and schedules no retry when no SMS provider is configured', async () => {
    sms.execute.mockResolvedValue({ sent: false, reason: 'NO_PROVIDER' });
    await service.attemptSend('log-1', 'SMS', {
      recipientId: 'u1', organizationId: 'org-1', type: 'BOOKING_CONFIRMED',
      recipientPhone: '+966500000000', smsBody: 'hi',
    } as never, 1);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED', errorMessage: 'No SMS provider configured' }) }),
    );
    expect(prisma.notificationDeliveryLog.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    );
    expect(bullmq.getQueue).not.toHaveBeenCalled();
  });

  it('records SKIPPED when the email template is missing or inactive', async () => {
    email.execute.mockResolvedValue({ sent: false, reason: 'TEMPLATE_UNAVAILABLE' });
    await service.attemptSend('log-1', 'EMAIL', {
      recipientId: 'u1', organizationId: 'org-1', type: 'BOOKING_CONFIRMED',
      recipientEmail: 'a@b.com', emailTemplateSlug: 'missing',
    } as never, 1);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) }),
    );
  });

  it('sends email successfully', async () => {
    await service.attemptSend('log-1', 'EMAIL', {
      ...basePayload,
      recipientEmail: 'a@b.com',
      emailTemplateSlug: 'welcome',
      emailVars: { name: 'Alice' },
    }, 1);
    expect(email.execute).toHaveBeenCalledWith({ to: 'a@b.com', templateSlug: 'welcome', vars: { name: 'Alice' } });
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    );
  });

  it('sends sms successfully', async () => {
    await service.attemptSend('log-1', 'SMS', {
      ...basePayload,
      recipientPhone: '+966500000000',
      smsBody: 'Hello',
    }, 1);
    expect(sms.execute).toHaveBeenCalledWith({ phone: '+966500000000', body: 'Hello' });
  });

  it('sends push successfully with multiple tokens', async () => {
    await service.attemptSend('log-1', 'PUSH', {
      ...basePayload,
      fcmTokens: ['t1', 't2'],
      pushTitle: 'Title',
      pushBody: 'Body',
    }, 1);
    expect(push.execute).toHaveBeenCalledTimes(2);
  });

  it('sends push successfully with single token', async () => {
    await service.attemptSend('log-1', 'PUSH', {
      ...basePayload,
      fcmTokens: ['t1'],
      pushTitle: 'Title',
      pushBody: 'Body',
    }, 1);
    expect(push.execute).toHaveBeenCalledTimes(1);
  });

  describe('with the real SendPushHandler', () => {
    const pushPayload = {
      ...basePayload,
      fcmTokens: ['t1', 't2'],
      pushTitle: 'Title',
      pushBody: 'Body',
    };

    function useRealPush(availability: boolean | boolean[]) {
      const fcm = {
        isAvailable: Array.isArray(availability)
          ? jest.fn().mockReturnValueOnce(availability[0]).mockReturnValueOnce(availability[1])
          : jest.fn().mockReturnValue(availability),
        sendPush: jest.fn().mockResolvedValue('message-id'),
      };
      service = new ResilientNotificationDispatcher(
        prisma as unknown as PrismaService,
        bullmq as unknown as BullMqService,
        email as unknown as SendEmailHandler,
        sms as unknown as SendSmsHandler,
        new SendPushHandler(fcm as unknown as FcmService),
      );
      return fcm;
    }

    it('records SKIPPED without a retry or provider call when FCM is unavailable', async () => {
      const fcm = useRealPush(false);
      await service.dispatch(pushPayload, ['push']);
      expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledTimes(1);
      expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'SKIPPED', attempts: 1, lastAttemptAt: expect.any(Date),
          errorMessage: 'No FCM provider configured',
        },
      });
      expect(fcm.sendPush).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('records SENT after available FCM sends successfully', async () => {
      const fcm = useRealPush(true);
      await service.attemptSend('log-1', 'PUSH', pushPayload, 1);
      expect(fcm.sendPush).toHaveBeenCalledTimes(2);
      expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('retries genuine provider failure when every token rejects', async () => {
      const fcm = useRealPush(true);
      fcm.sendPush.mockRejectedValue(new Error('FCM transport failure'));
      await service.attemptSend('log-1', 'PUSH', pushPayload, 1);
      expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'retry', expect.objectContaining({ attempt: 2 }),
        expect.objectContaining({ delay: 30_000 }),
      );
    });

    it('preserves SENT without retry when one token sends and another rejects', async () => {
      const fcm = useRealPush(true);
      fcm.sendPush.mockRejectedValueOnce(new Error('invalid token'));
      await service.attemptSend('log-1', 'PUSH', pushPayload, 1);
      expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('records SENT when one token sends and another skips', async () => {
      const fcm = useRealPush([true, false]);
      await service.attemptSend('log-1', 'PUSH', pushPayload, 1);
      expect(fcm.sendPush).toHaveBeenCalledTimes(1);
      expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('retries a genuine failure when the other token skips and none sends', async () => {
      const fcm = useRealPush([true, false]);
      fcm.sendPush.mockRejectedValueOnce(new Error('FCM transport failure'));
      await service.attemptSend('log-1', 'PUSH', pushPayload, 1);
      expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'retry', expect.objectContaining({ attempt: 2 }),
        expect.objectContaining({ delay: 30_000 }),
      );
    });
  });

  // ── attemptSend failure + retry paths ──────────────────────────────────

  it('schedules retry on email failure (attempt 1)', async () => {
    email.execute.mockRejectedValue(new Error('SMTP down'));
    await service.attemptSend('log-1', 'EMAIL', {
      ...basePayload,
      recipientEmail: 'a@b.com',
      emailTemplateSlug: 'welcome',
    }, 1);
    expect(queue.add).toHaveBeenCalledWith(
      'retry',
      expect.objectContaining({ attempt: 2 }),
      expect.objectContaining({ delay: 30_000 }),
    );
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', errorMessage: 'SMTP down' }) }),
    );
  });

  it('schedules retry on sms failure (attempt 2)', async () => {
    sms.execute.mockRejectedValue(new Error('Provider error'));
    await service.attemptSend('log-1', 'SMS', {
      ...basePayload,
      recipientPhone: '+966500000000',
      smsBody: 'Hi',
    }, 2);
    expect(queue.add).toHaveBeenCalledWith(
      'retry',
      expect.objectContaining({ attempt: 3 }),
      expect.objectContaining({ delay: 120_000 }),
    );
  });

  it('schedules retry on push failure (attempt 3)', async () => {
    push.execute.mockRejectedValue(new Error('FCM error'));
    await service.attemptSend('log-1', 'PUSH', {
      ...basePayload,
      fcmTokens: ['t1'],
      pushTitle: 'Title',
      pushBody: 'Body',
    }, 3);
    expect(queue.add).toHaveBeenCalledWith(
      'retry',
      expect.objectContaining({ attempt: 4 }),
      expect.objectContaining({ delay: 300_000 }),
    );
  });

  it('gives up after max retries (attempt 4)', async () => {
    email.execute.mockRejectedValue(new Error('SMTP down'));
    await service.attemptSend('log-1', 'EMAIL', {
      ...basePayload,
      recipientEmail: 'a@b.com',
      emailTemplateSlug: 'welcome',
    }, 4);
    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', jobId: null }) }),
    );
  });

  it('handles non-Error rejection', async () => {
    email.execute.mockRejectedValue('string error');
    await service.attemptSend('log-1', 'EMAIL', {
      ...basePayload,
      recipientEmail: 'a@b.com',
      emailTemplateSlug: 'welcome',
    }, 1);
    expect(queue.add).toHaveBeenCalled();
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorMessage: 'string error' }) }),
    );
  });

  // ── runChannel error paths ─────────────────────────────────────────────

  it('marks failed when email payload is incomplete', async () => {
    await service.attemptSend('log-1', 'EMAIL', { ...basePayload }, 1);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorMessage: 'Missing email address or template slug' }) }),
    );
  });

  it('marks failed when sms payload is incomplete', async () => {
    await service.attemptSend('log-1', 'SMS', { ...basePayload }, 1);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorMessage: 'Missing phone or SMS body' }) }),
    );
  });

  it('marks failed when push payload has no tokens', async () => {
    await service.attemptSend('log-1', 'PUSH', { ...basePayload, pushTitle: 'T', pushBody: 'B' }, 1);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorMessage: 'Missing FCM tokens or push content' }) }),
    );
  });

  it('marks failed when push payload has no title/body', async () => {
    await service.attemptSend('log-1', 'PUSH', { ...basePayload, fcmTokens: ['t1'] }, 1);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorMessage: 'Missing FCM tokens or push content' }) }),
    );
  });

  it('marks failed when all push tokens fail', async () => {
    push.execute.mockRejectedValue(new Error('invalid token'));
    await service.attemptSend('log-1', 'PUSH', {
      ...basePayload,
      fcmTokens: ['t1', 't2'],
      pushTitle: 'Title',
      pushBody: 'Body',
    }, 1);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorMessage: expect.stringContaining('All PUSH notifications failed') }) }),
    );
  });

  it('succeeds when some push tokens fail but not all', async () => {
    push.execute
      .mockRejectedValueOnce(new Error('invalid token'))
      .mockResolvedValueOnce({ sent: true });
    await service.attemptSend('log-1', 'PUSH', {
      ...basePayload,
      fcmTokens: ['t1', 't2'],
      pushTitle: 'Title',
      pushBody: 'Body',
    }, 1);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    );
  });

  it('resolveToAddress returns email for EMAIL channel', async () => {
    await service.dispatch({ ...basePayload, recipientEmail: 'a@b.com' }, ['email']);
    expect(prisma.notificationDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toAddress: 'a@b.com' }) }),
    );
  });

  it('resolveToAddress returns phone for SMS channel', async () => {
    await service.dispatch({ ...basePayload, recipientPhone: '+966500000000' }, ['sms']);
    expect(prisma.notificationDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toAddress: '+966500000000' }) }),
    );
  });

  it('resolveToAddress returns tokens for PUSH channel', async () => {
    await service.dispatch({ ...basePayload, fcmTokens: ['t1', 't2'] }, ['push']);
    expect(prisma.notificationDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toAddress: 't1,t2' }) }),
    );
  });
});
