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

  it('throws the response body text on non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('validation failed'),
    });
    await expect(
      submitContactMessage({ name: 'A', body: 'hi' }),
    ).rejects.toThrow('validation failed');
  });

  it('falls back to status-code message when body text is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    });
    await expect(
      submitContactMessage({ name: 'A', body: 'hi' }),
    ).rejects.toThrow('Submission failed: 500');
  });
});
