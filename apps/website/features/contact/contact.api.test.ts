import { describe, it, expect, vi, beforeEach } from 'vitest';

const { publicFetchMock, PublicFetchErrorMock } = vi.hoisted(() => {
  class FakePublicFetchError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`PublicFetchError: ${status}`);
    }
  }

  return {
    publicFetchMock: vi.fn(),
    PublicFetchErrorMock: FakePublicFetchError,
  };
});

vi.mock('@/lib/public-fetch', () => ({
  publicFetch: publicFetchMock,
  PublicFetchError: PublicFetchErrorMock,
}));

import { submitContactMessage } from './contact.api';

describe('contact.api — submitContactMessage', () => {
  beforeEach(() => {
    publicFetchMock.mockReset();
  });

  it('POSTs JSON through the CSRF-aware public request helper', async () => {
    publicFetchMock.mockResolvedValue(undefined);
    await submitContactMessage({ name: 'A', body: 'hello world', phone: '+966500000000' });
    const [url, init] = publicFetchMock.mock.calls[0];
    expect(url).toBe('/public/contact-messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      name: 'A',
      body: 'hello world',
      phone: '+966500000000',
    });
  });

  it('throws a clean status-only error and never surfaces the raw body text', async () => {
    publicFetchMock.mockRejectedValue(
      new PublicFetchErrorMock(422, { message: 'validation failed' }),
    );
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
    publicFetchMock.mockRejectedValue(new PublicFetchErrorMock(500, {}));
    await expect(
      submitContactMessage({ name: 'A', body: 'hi' }),
    ).rejects.toThrow('Contact submission failed: 500');
  });
});
