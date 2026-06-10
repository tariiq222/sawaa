import { AuthenticaClient, AuthenticaError } from './authentica.client';

import * as fetchModule from '../http/fetch-with-timeout';

describe('AuthenticaClient', () => {
  let client: AuthenticaClient;

  beforeEach(() => {
    client = new AuthenticaClient({
      get: jest.fn((key: string) => {
        if (key === 'AUTHENTICA_API_KEY') return 'test-key';
        if (key === 'AUTHENTICA_BASE_URL') return 'https://api.authentica.sa';
        return undefined;
      }),
    } as any);
  });

  it('should be configured', () => {
    expect(client.isConfigured()).toBe(true);
  });

  it('should not be configured when no key', () => {
    const c = new AuthenticaClient({ get: () => undefined } as any);
    expect(c.isConfigured()).toBe(false);
  });

  it('should skip sendOtp when unconfigured', async () => {
    const c = new AuthenticaClient({ get: () => undefined } as any);
    await expect(c.sendOtp({ channel: 'SMS', identifier: '+966501234567', code: '123456' })).resolves.not.toThrow();
  });

  it('should send OTP via SMS', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);
    await client.sendOtp({ channel: 'SMS', identifier: '+966501234567', code: '123456' });
    expect(fetchModule.fetchWithTimeout).toHaveBeenCalled();
  });

  it('should send OTP via EMAIL', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);
    await client.sendOtp({ channel: 'EMAIL', identifier: 'test@example.com', code: '123456' });
    expect(fetchModule.fetchWithTimeout).toHaveBeenCalled();
  });

  it('should throw on error response', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ errors: [{ message: 'Invalid code' }] }),
    } as any);
    await expect(client.sendOtp({ channel: 'SMS', identifier: '+966501234567', code: '123456' })).rejects.toThrow(AuthenticaError);
  });

  it('should use the provider message from a valid error body', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ errors: [{ message: 'Template id does not match channel' }] }),
    } as any);
    await expect(
      client.sendOtp({ channel: 'SMS', identifier: '+966501234567', code: '123456' }),
    ).rejects.toThrow('Template id does not match channel');
  });

  it('should warn once and fall back to statusText when the error body is malformed JSON', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: { get: (name: string) => (name === 'content-type' ? 'text/html' : null) },
      json: async () => {
        throw new SyntaxError(`Unexpected token '<', "<html>" is not valid JSON`);
      },
    } as any);
    const warnSpy = jest.spyOn((client as any).logger, 'warn').mockImplementation(() => undefined);

    await expect(
      client.sendOtp({ channel: 'SMS', identifier: '+966501234567', code: '123456' }),
    ).rejects.toThrow('Bad Gateway');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = warnSpy.mock.calls[0][0] as string;
    expect(logged).toContain('status=502');
    expect(logged).toContain('content-type=text/html');
    // Never leak the response body — SyntaxError messages embed a snippet of it.
    expect(logged).not.toContain('<html>');
  });

  it('should return balance', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { balance: 100 } }),
    } as any);
    const balance = await client.getBalance();
    expect(balance).toBe(100);
  });

  it('should return 0 balance when unconfigured', async () => {
    const c = new AuthenticaClient({ get: () => undefined } as any);
    const balance = await c.getBalance();
    expect(balance).toBe(0);
  });
});
