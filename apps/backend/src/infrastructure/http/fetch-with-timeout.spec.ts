import { fetchWithTimeout } from './fetch-with-timeout';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should return response on success', async () => {
    const mockResponse = { ok: true } as Response;
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout('https://example.com/test');
    expect(result).toBe(mockResponse);
  });

  it('should throw original error for non-timeout abort', async () => {
    const abortError = new Error('User aborted');
    abortError.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortError);

    await expect(fetchWithTimeout('https://example.com')).rejects.toThrow('User aborted');
  });

  it('should throw generic fetch error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    await expect(fetchWithTimeout('https://example.com')).rejects.toThrow('network');
  });

  it('should merge caller signal with timeout signal', async () => {
    const mockResponse = { ok: true } as Response;
    global.fetch = jest.fn().mockResolvedValue(mockResponse);
    const controller = new AbortController();

    await fetchWithTimeout('https://example.com', { signal: controller.signal }, 5000);
    expect(global.fetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it('keeps the deadline active through response body parsing', async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const abortError = new Error('body aborted');
    abortError.name = 'AbortError';
    const mockResponse = {
      ok: true,
      json: jest.fn(() => new Promise((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(abortError), { once: true });
      })),
    } as unknown as Response;
    global.fetch = jest.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      requestSignal = options?.signal as AbortSignal;
      return mockResponse;
    });

    const response = await fetchWithTimeout('https://example.com/slow-body', {}, 25);
    const bodyPromise = response.json();
    void bodyPromise.catch(() => undefined);
    await jest.advanceTimersByTimeAsync(26);

    expect(requestSignal?.aborted).toBe(true);
    await expect(bodyPromise).rejects.toThrow(
      'fetchWithTimeout: request to example.com timed out after 25ms',
    );
  });

  it('preserves caller cancellation while parsing the response body', async () => {
    let requestSignal: AbortSignal | undefined;
    const callerAbort = new Error('caller stopped request');
    callerAbort.name = 'AbortError';
    global.fetch = jest.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      requestSignal = options?.signal as AbortSignal;
      return {
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () => reject(callerAbort), { once: true });
        }),
      } as unknown as Response;
    });
    const controller = new AbortController();

    const response = await fetchWithTimeout(
      'https://example.com/cancelled-body',
      { signal: controller.signal },
      5_000,
    );
    const bodyPromise = response.json();
    controller.abort();

    await expect(bodyPromise).rejects.toBe(callerAbort);
  });
});
