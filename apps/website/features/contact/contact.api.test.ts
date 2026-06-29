import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitContactMessage } from './contact.api';

describe('contact.api — submitContactMessage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs JSON to /api/v1/public/contact-messages', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await submitContactMessage({ name: 'A', body: 'hello world', phone: '+966500000000' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/public\/contact-messages$/);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      name: 'A',
      body: 'hello world',
      phone: '+966500000000',
    });
  });

  it('throws a clean status-only error and never surfaces the raw body text', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('{"statusCode":422,"message":"validation failed"}'),
    });
    // The raw backend body (English / JSON) must NOT leak into the error the UI
    // would render — only the status is kept, for logging.
    await expect(
      submitContactMessage({ name: 'A', body: 'hi' }),
    ).rejects.toThrow('Contact submission failed: 422');
    await expect(
      submitContactMessage({ name: 'A', body: 'hi' }),
    ).rejects.not.toThrow(/validation failed/);
  });

  it('keeps the status code in the thrown error for logging', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    });
    await expect(
      submitContactMessage({ name: 'A', body: 'hi' }),
    ).rejects.toThrow('Contact submission failed: 500');
  });
});
