import { Test } from '@nestjs/testing';
import { SendNotificationHandler } from './send-notification.handler';
import { PrismaService } from '../../../infrastructure/database';
import { SendPushHandler } from '../send-push/send-push.handler';
import { SendEmailHandler } from '../send-email/send-email.handler';
import { SendSmsHandler } from '../send-sms/send-sms.handler';
import { ResilientNotificationDispatcher } from '../resilient-notification-dispatcher/resilient-notification-dispatcher.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';

describe('SendNotificationHandler', () => {
  let handler: SendNotificationHandler;
  let prisma: { notification: { create: jest.Mock } };
  let push: { execute: jest.Mock };
  let email: { execute: jest.Mock };
  let sms: { execute: jest.Mock };
  let dispatcher: { dispatch: jest.Mock };

  beforeEach(async () => {
    prisma = { notification: { create: jest.fn() } };
    push = { execute: jest.fn() };
    email = { execute: jest.fn() };
    sms = { execute: jest.fn() };
    dispatcher = { dispatch: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SendNotificationHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SendPushHandler, useValue: push },
        { provide: SendEmailHandler, useValue: email },
        { provide: SendSmsHandler, useValue: sms },
        { provide: ResilientNotificationDispatcher, useValue: dispatcher },
      ],
    }).compile();

    handler = module.get(SendNotificationHandler);
  });

  const baseDto = {
    recipientId: 'user-1',
    recipientType: 'CLIENT' as const,
    type: 'BOOKING_CONFIRMED' as const,
    title: 'Title',
    body: 'Body',
    channels: [] as Array<'email' | 'sms' | 'push'>,
  };

  it('persists in-app notification and returns for non-critical with no channels', async () => {
    await handler.execute({ ...baseDto, type: 'GENERIC' as any, channels: [] });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(push.execute).not.toHaveBeenCalled();
  });

  it('uses explicit organizationId when provided', async () => {
    await handler.execute({ ...baseDto, type: 'GENERIC' as any, channels: [], organizationId: 'org-123' });
    // just verifies no throw; orgId is used in critical path
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('logs error when in-app persistence fails but continues', async () => {
    prisma.notification.create.mockRejectedValue(new Error('DB down'));
    const loggerSpy = jest.spyOn((handler as any).logger, 'error').mockImplementation(() => {});
    await handler.execute({ ...baseDto, type: 'GENERIC' as any, channels: [] });
    expect(loggerSpy).toHaveBeenCalledWith('Failed to persist in-app notification', expect.any(Error));
    loggerSpy.mockRestore();
  });

  // ── CRITICAL type paths ────────────────────────────────────────────────

  it('critical: dispatches email channel', async () => {
    await handler.execute({
      ...baseDto,
      type: 'BOOKING_CONFIRMED',
      channels: ['email'],
      recipientEmail: 'a@b.com',
      emailTemplateSlug: 'welcome',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'a@b.com', emailTemplateSlug: 'welcome' }),
      ['email'],
    );
  });

  it('critical: dispatches sms channel', async () => {
    await handler.execute({
      ...baseDto,
      type: 'PAYMENT_RECEIVED',
      channels: ['sms'],
      recipientPhone: '+966500000000',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: '+966500000000' }),
      ['sms'],
    );
  });

  it('critical: dispatches push channel with fcmTokens', async () => {
    await handler.execute({
      ...baseDto,
      type: 'PAYMENT_COMPLETED',
      channels: ['push'],
      fcmTokens: ['token1', 'token2'],
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ fcmTokens: ['token1', 'token2'] }),
      ['push'],
    );
  });

  it('critical: dispatches push channel with single fcmToken', async () => {
    await handler.execute({
      ...baseDto,
      type: 'PAYMENT_FAILED',
      channels: ['push'],
      fcmToken: 'single-token',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ fcmTokens: ['single-token'] }),
      ['push'],
    );
  });

  it('critical: no push dispatch when no tokens', async () => {
    await handler.execute({
      ...baseDto,
      type: 'BOOKING_CONFIRMED',
      channels: ['push'],
    });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('critical: no email dispatch when missing email or slug', async () => {
    await handler.execute({
      ...baseDto,
      type: 'BOOKING_CONFIRMED',
      channels: ['email'],
      recipientEmail: 'a@b.com',
      // missing emailTemplateSlug
    });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('critical: no sms dispatch when missing phone', async () => {
    await handler.execute({
      ...baseDto,
      type: 'BOOKING_CONFIRMED',
      channels: ['sms'],
    });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('critical: dispatches multiple channels', async () => {
    await handler.execute({
      ...baseDto,
      type: 'BOOKING_CONFIRMED',
      channels: ['email', 'sms', 'push'],
      recipientEmail: 'a@b.com',
      emailTemplateSlug: 'welcome',
      recipientPhone: '+966500000000',
      fcmTokens: ['t1'],
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(expect.anything(), ['email', 'sms', 'push']);
  });

  // ── STANDARD type paths ────────────────────────────────────────────────

  it('standard: sends push notifications', async () => {
    await handler.execute({
      ...baseDto,
      type: 'GENERIC' as any,
      channels: ['push'],
      fcmTokens: ['token1', 'token2'],
    });
    expect(push.execute).toHaveBeenCalledTimes(2);
    expect(push.execute).toHaveBeenCalledWith({ token: 'token1', title: 'Title', body: 'Body' });
    expect(push.execute).toHaveBeenCalledWith({ token: 'token2', title: 'Title', body: 'Body' });
  });

  it('standard: sends push with single fcmToken', async () => {
    await handler.execute({
      ...baseDto,
      type: 'GENERIC' as any,
      channels: ['push'],
      fcmToken: 'single',
    });
    expect(push.execute).toHaveBeenCalledTimes(1);
  });

  it('standard: no push when no tokens', async () => {
    await handler.execute({
      ...baseDto,
      type: 'GENERIC' as any,
      channels: ['push'],
    });
    expect(push.execute).not.toHaveBeenCalled();
  });

  it('standard: sends email', async () => {
    await handler.execute({
      ...baseDto,
      type: 'GENERIC' as any,
      channels: ['email'],
      recipientEmail: 'a@b.com',
      emailTemplateSlug: 'welcome',
      emailVars: { name: 'Alice' },
    });
    expect(email.execute).toHaveBeenCalledWith({
      to: 'a@b.com',
      templateSlug: 'welcome',
      vars: { name: 'Alice' },
    });
  });

  it('standard: no email when missing email or slug', async () => {
    await handler.execute({
      ...baseDto,
      type: 'GENERIC' as any,
      channels: ['email'],
      recipientEmail: 'a@b.com',
    });
    expect(email.execute).not.toHaveBeenCalled();
  });

  it('standard: sends sms', async () => {
    await handler.execute({
      ...baseDto,
      type: 'GENERIC' as any,
      channels: ['sms'],
      recipientPhone: '+966500000000',
    });
    expect(sms.execute).toHaveBeenCalledWith({ phone: '+966500000000', body: 'Body' });
  });

  it('standard: no sms when missing phone', async () => {
    await handler.execute({
      ...baseDto,
      type: 'GENERIC' as any,
      channels: ['sms'],
    });
    expect(sms.execute).not.toHaveBeenCalled();
  });

  it('standard: sends multiple channels', async () => {
    await handler.execute({
      ...baseDto,
      type: 'GENERIC' as any,
      channels: ['push', 'email', 'sms'],
      fcmTokens: ['t1'],
      recipientEmail: 'a@b.com',
      emailTemplateSlug: 'welcome',
      recipientPhone: '+966500000000',
    });
    expect(push.execute).toHaveBeenCalledTimes(1);
    expect(email.execute).toHaveBeenCalledTimes(1);
    expect(sms.execute).toHaveBeenCalledTimes(1);
  });
});
