import { ResendEmailAdapter } from './resend.adapter';
import * as fetchModule from '../http/fetch-with-timeout';

describe('ResendEmailAdapter', () => {
  let adapter: ResendEmailAdapter;

  beforeEach(() => {
    adapter = new ResendEmailAdapter({ apiKey: 'test-key' });
  });

  it('should be available', () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should send mail with name and email', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-1' }),
    } as any);
    const result = await adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>', fromName: 'Test', fromEmail: 'test@example.com' });
    expect(result.messageId).toBe('msg-1');
  });

  it('should send mail with default from', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-1' }),
    } as any);
    const result = await adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result.messageId).toBe('msg-1');
  });

  it('should throw on error', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    } as any);
    await expect(adapter.sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('Resend API error');
  });
});
