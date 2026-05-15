import { fetchWithTimeout } from './fetch-with-timeout';

describe('fetchWithTimeout', () => {
  afterEach(() => jest.restoreAllMocks());

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
});
