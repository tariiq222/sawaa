import { ResendEmailAdapter } from '../../../infrastructure/email/resend.adapter';
import { SendGridEmailAdapter } from '../../../infrastructure/email/sendgrid.adapter';
import { MailchimpEmailAdapter } from '../../../infrastructure/email/mailchimp.adapter';
import { EmailChannelAdapter } from '../../comms/notification-channel/email-channel.adapter';
import * as fetchModule from '../../../infrastructure/http/fetch-with-timeout';
import { MobileEmailDelivery } from './mobile-email-delivery';

describe('MobileEmailDelivery', () => {
  it('fails closed before invoking a silently-disabled SMS adapter', async () => {
    const resolve = jest.fn();
    const delivery = new MobileEmailDelivery({ resolve } as never, { isConfigured: () => false } as never);
    await expect(delivery.send('SMS', '+966512345678', '123456')).rejects.toMatchObject({ status: 503, response: { code: 'delivery_unavailable' } });
    expect(resolve).not.toHaveBeenCalled();
  });
  it('redacts provider failure and marks ambiguous sends unknown', async () => {
    const delivery = new MobileEmailDelivery({ resolve: () => ({ send: async () => { throw Error('secret 123456'); } }) } as never, {} as never);
    await expect(delivery.send('EMAIL', 'person@example.test', '123456')).rejects.toMatchObject({ outcome: 'unknown', response: { code: 'delivery_unavailable' } });
  });
});

it('does not charge an explicitly unconfigured email provider as an ambiguous send', async () => {
  const adapterModule = await import('../../comms/notification-channel/email-channel.adapter');
  const factory = { resolve: async () => ({ isAvailable: () => false }) };
  const adapter = new adapterModule.EmailChannelAdapter(factory as never);
  const delivery = new MobileEmailDelivery({ resolve: () => adapter } as never, {} as never);
  await expect(delivery.send('EMAIL', 'person@example.test', '123456')).rejects.toMatchObject({ outcome: 'rejected', response: { code: 'delivery_unavailable' } });
});

describe('explicit email provider rejections', () => {
  const payload = { to: 'person@example.test', subject: 'OTP', html: '123456' };
  const factories = [
    ['Resend', () => new ResendEmailAdapter({ apiKey: 'synthetic' })],
    ['SendGrid', () => new SendGridEmailAdapter({ apiKey: 'synthetic' })],
    ['Mandrill', () => new MailchimpEmailAdapter({ apiKey: 'synthetic' })],
  ] as const;
  afterEach(() => jest.restoreAllMocks());
  for (const [name, factory] of factories) {
    it.each([
      [400, 'rejected'], [401, 'rejected'], [403, 'rejected'], [429, 'rejected'],
      [408, 'unknown'], [500, 'unknown'], [503, 'unknown'],
    ])(`${name} HTTP %s is %s`, async (status, outcome) => {
      jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({ ok: false, status, text: async () => '123456 person@example.test' } as Response);
      const channel = new EmailChannelAdapter({ resolve: async () => factory() } as never);
      const delivery = new MobileEmailDelivery({ resolve: () => channel } as never, {} as never);
      await expect(delivery.send('EMAIL', payload.to, '123456')).rejects.toMatchObject({ outcome, response: { code: 'delivery_unavailable' } });
    });
    it(`${name} network timeout remains unknown`, async () => {
      jest.spyOn(fetchModule, 'fetchWithTimeout').mockRejectedValue(new Error('timeout after write'));
      const channel = new EmailChannelAdapter({ resolve: async () => factory() } as never);
      const delivery = new MobileEmailDelivery({ resolve: () => channel } as never, {} as never);
      await expect(delivery.send('EMAIL', payload.to, '123456')).rejects.toMatchObject({ outcome: 'unknown' });
    });
    it(`${name} constructs safe errors without recipient or code from provider response`, async () => {
      jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({ ok: false, status: 400, text: async () => '123456 person@example.test' } as Response);
      const error = await factory().sendMail(payload).then(() => null, (failure: unknown) => failure);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toMatch(/123456|person@example.test/);
    });
  }
  it.each(['rejected', 'invalid'])('Mandrill %s outcome is a definite rejection', async status => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({ ok: true, json: async () => [{ status }] } as Response);
    const channel = new EmailChannelAdapter({ resolve: async () => new MailchimpEmailAdapter({ apiKey: 'synthetic' }) } as never);
    const delivery = new MobileEmailDelivery({ resolve: () => channel } as never, {} as never);
    await expect(delivery.send('EMAIL', payload.to, '123456')).rejects.toMatchObject({ outcome: 'rejected' });
  });
  it('preserves Mandrill queued as provider acceptance', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({ ok: true, json: async () => [{ status: 'queued', _id: 'queued-id' }] } as Response);
    const channel = new EmailChannelAdapter({ resolve: async () => new MailchimpEmailAdapter({ apiKey: 'synthetic' }) } as never);
    const delivery = new MobileEmailDelivery({ resolve: () => channel } as never, {} as never);
    await expect(delivery.send('EMAIL', payload.to, '123456')).resolves.toBeUndefined();
  });
});
