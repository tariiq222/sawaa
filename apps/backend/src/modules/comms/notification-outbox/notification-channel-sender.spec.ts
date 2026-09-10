import { createHash } from 'node:crypto';
import { ResendEmailAdapter } from '../../../infrastructure/email/resend.adapter';
import { EmailProviderNotConfiguredError } from '../../../infrastructure/email/email-provider.interface';

import { SmsProviderNotConfiguredError } from '../../../infrastructure/sms/sms-provider.interface';
import { NotificationChannelSender } from './notification-channel-sender';

describe('NotificationChannelSender', () => {
  const prisma = {
    smsDelivery: { create: jest.fn() },
  };
  const smsFactory = { resolve: jest.fn() };
  const emailFactory = { resolve: jest.fn() };
  const fcm = { isAvailable: jest.fn(), sendPush: jest.fn() };
  let sender: NotificationChannelSender;

  beforeEach(() => {
    jest.clearAllMocks();
    sender = new NotificationChannelSender(
      prisma as never,
      smsFactory as never,
      emailFactory as never,
      fcm as never,
    );
  });

  it('never reports success when SMS has no configured provider', async () => {
    smsFactory.resolve.mockResolvedValue({
      name: 'NONE',
      send: jest.fn().mockRejectedValue(new SmsProviderNotConfiguredError()),
    });

    const result = await sender.send({
      id: 'delivery-sms-none',
      channel: 'SMS',
      targetAddress: '+966500000001',
      channelPayload: { channel: 'SMS', body: 'موعدك غدًا' },
    } as never);

    expect(result.outcome).not.toBe('ACCEPTED');
    expect(result.outcome).not.toBe('DELIVERED');
    expect(result.outcome).toBe('DEAD');
    expect(prisma.smsDelivery.create).not.toHaveBeenCalled();
  });

  it('records an SMS audit row and returns the provider receipt', async () => {
    const send = jest.fn().mockResolvedValue({
      providerMessageId: 'sms-receipt-1',
      status: 'QUEUED',
    });
    smsFactory.resolve.mockResolvedValue({
      name: 'TAQNYAT',
      send,
    });
    prisma.smsDelivery.create.mockResolvedValue({ id: 'sms-audit-1' });

    const result = await sender.send({
      id: 'delivery-sms-1',
      channel: 'SMS',
      targetAddress: '+966500000001',
      channelPayload: { channel: 'SMS', body: 'موعدك غدًا' },
    } as never);

    expect(send).toHaveBeenCalledWith('+966500000001', 'موعدك غدًا', null);
    expect(prisma.smsDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'TAQNYAT',
        toPhone: '+966500000001',
        body: 'موعدك غدًا',
        bodyHash: createHash('sha256').update('موعدك غدًا').digest('hex'),
        providerMessageId: 'sms-receipt-1',
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        outcome: 'ACCEPTED',
        providerName: 'TAQNYAT',
        providerMessageId: 'sms-receipt-1',
      }),
    );
  });

  it('passes frozen escaped email HTML through unchanged', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'email-1' });
    emailFactory.resolve.mockResolvedValue({
      name: 'RESEND',
      isAvailable: () => true,
      sendMail,
    });

    const html = '<p>مرحبًا &amp; موعدك</p>';
    const result = await sender.send({
      id: 'delivery-email-1',
      channel: 'EMAIL',
      targetAddress: 'client@example.com',
      channelPayload: {
        channel: 'EMAIL',
        templateSlug: 'booking-created',
        subject: 'موعد جديد',
        html,
      },
    } as never);

    expect(sendMail).toHaveBeenCalledWith({
      to: 'client@example.com',
      subject: 'موعد جديد',
      html,
    });
    expect(result).toEqual(
      expect.objectContaining({
        outcome: 'ACCEPTED',
        providerName: 'RESEND',
        providerMessageId: 'email-1',
      }),
    );
  });

  it('sends exactly one frozen push token per delivery row', async () => {
    fcm.isAvailable.mockReturnValue(true);
    fcm.sendPush.mockResolvedValue('fcm-message-1');

    const result = await sender.send({
      id: 'delivery-push-token-1',
      channel: 'PUSH',
      targetAddress: 'token-a',
      channelPayload: {
        channel: 'PUSH',
        title: 'موعدك',
        body: 'غدًا',
        data: { bookingId: 'booking-1' },
      },
    } as never);

    expect(fcm.sendPush).toHaveBeenCalledWith(
      'token-a',
      'موعدك',
      'غدًا',
      { bookingId: 'booking-1' },
    );
    expect(result).toEqual(
      expect.objectContaining({
        outcome: 'ACCEPTED',
        providerName: 'FCM',
        providerMessageId: 'fcm-message-1',
      }),
    );
  });

  const frozenEmail = {
    id: 'frozen-email', channel: 'EMAIL' as const, targetAddress: 'test@example.test',
    channelPayload: { channel: 'EMAIL', subject: 'Test', html: '<p>Test</p>' },
  };

  it('classifies a real Resend adapter HTTP 429 rejection as a safe retry', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('sensitive provider body', { status: 429 }));
    try {
      emailFactory.resolve.mockResolvedValue(new ResendEmailAdapter({ apiKey: 'fake-test-key' }));
      expect(await sender.send(frozenEmail)).toEqual(expect.objectContaining({ outcome: 'RETRY_WAIT', reason: 'SAFE_TRANSIENT', errorCode: 'RATE_LIMITED' }));
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { fetch.mockRestore(); }
  });

  it('does not turn raw HTTP 500 response text containing 429 into a safe retry', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Resend API error 429: user-controlled body', { status: 500 }));
    try {
      emailFactory.resolve.mockResolvedValue(new ResendEmailAdapter({ apiKey: 'fake-test-key' }));
      expect(await sender.send(frozenEmail)).toEqual(expect.objectContaining({ outcome: 'UNKNOWN', errorCode: 'PROVIDER_ERROR' }));
    } finally { fetch.mockRestore(); }
  });

  it('does not preserve arbitrary token-shaped provider error codes', async () => {
    emailFactory.resolve.mockResolvedValue({ name: 'RESEND', isAvailable: () => true,
      sendMail: jest.fn().mockRejectedValue(Object.assign(new Error('private'), { code: 'SECRET_TOKEN_ABC123' })),
    });
    expect(await sender.send(frozenEmail)).toEqual(expect.objectContaining({ outcome: 'UNKNOWN', errorCode: 'PROVIDER_ERROR' }));
  });

  it('treats typed missing email configuration as a known pre-send failure', async () => {
    emailFactory.resolve.mockRejectedValue(new EmailProviderNotConfiguredError());
    expect(await sender.send(frozenEmail)).toEqual(expect.objectContaining({ outcome: 'DEAD', reason: 'NO_PROVIDER' }));
  });

  it('does not offer a configuration retry for malformed immutable channel content', async () => {
    expect(await sender.send({ ...frozenEmail, channelPayload: { channel: 'EMAIL' } })).toEqual(expect.objectContaining({ outcome: 'DEAD', reason: 'INVALID_PAYLOAD' }));
    expect(emailFactory.resolve).not.toHaveBeenCalled();
  });

  it('cannot classify a post-acceptance SMS audit failure as a safe provider rejection', async () => {
    smsFactory.resolve.mockResolvedValue({ name: 'TAQNYAT', send: jest.fn().mockResolvedValue({ providerMessageId: 'accepted', status: 'SENT' }) });
    prisma.smsDelivery.create.mockRejectedValue(new Error('Taqnyat HTTP 429: synthetic database failure'));
    expect(await sender.send({ id: 'sms', channel: 'SMS', targetAddress: '+966500000001', channelPayload: { body: 'Test' } })).toEqual(expect.objectContaining({ outcome: 'UNKNOWN' }));
  });

});
