import { SendGridEmailAdapter } from './sendgrid.adapter';
import * as fetchModule from '../http/fetch-with-timeout';

describe('SendGridEmailAdapter', () => {
  let adapter: SendGridEmailAdapter;

  beforeEach(() => {
    adapter = new SendGridEmailAdapter({ apiKey: 'test-key' });
  });

  it('should be available', () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should send mail with from name', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 202,
      headers: { get: jest.fn().mockReturnValue('msg-1') },
      text: async () => '',
    } as any);
    const result = await adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>', fromName: 'Test', fromEmail: 'test@example.com' });
    expect(result.messageId).toBe('msg-1');
  });

  it('should send mail without from name', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 202,
      headers: { get: jest.fn().mockReturnValue(null) },
      text: async () => '',
    } as any);
    const result = await adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result.messageId).toBe('sendgrid-ok');
  });

  it('should throw on error', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    } as any);
    await expect(adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('SendGrid API error');
  });
});
