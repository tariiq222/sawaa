import { fetchWithTimeout } from './fetch-with-timeout';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('ok'));
    const res = await fetchWithTimeout('http://example.com/test');
    expect(res).toBeInstanceOf(Response);
  });

  it('should merge caller signal with timeout signal', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('ok'));
    const controller = new AbortController();
    await fetchWithTimeout('http://example.com/test', { signal: controller.signal });
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should rethrow non-timeout abort errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    await expect(fetchWithTimeout('http://example.com/test')).rejects.toThrow('Aborted');
  });

  it('should rethrow other errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    await expect(fetchWithTimeout('http://example.com/test')).rejects.toThrow('Network error');
  });
});
