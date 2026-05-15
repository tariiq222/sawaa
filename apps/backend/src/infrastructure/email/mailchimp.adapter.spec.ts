import { MailchimpEmailAdapter } from './mailchimp.adapter';
import * as fetchModule from '../http/fetch-with-timeout';

describe('MailchimpEmailAdapter', () => {
  let adapter: MailchimpEmailAdapter;

  beforeEach(() => {
    adapter = new MailchimpEmailAdapter({ apiKey: 'test-key' });
  });

  it('should be available', () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should send mail', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => [{ _id: 'msg-1', status: 'sent' }],
    } as any);
    const result = await adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>', fromName: 'Test', fromEmail: 'test@example.com' });
    expect(result.messageId).toBe('msg-1');
  });

  it('should throw on empty response', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);
    await expect(adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('Mailchimp returned empty response');
  });

  it('should throw on rejected status', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => [{ _id: 'msg-1', status: 'rejected' }],
    } as any);
    await expect(adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('Mailchimp rejected message');
  });

  it('should throw on invalid status', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => [{ _id: 'msg-1', status: 'invalid' }],
    } as any);
    await expect(adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('Mailchimp rejected message');
  });

  it('should throw on API error', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    } as any);
    await expect(adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('Mailchimp Transactional API error');
  });
});
