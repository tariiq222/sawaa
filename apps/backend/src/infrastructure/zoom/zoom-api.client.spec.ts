import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ZoomApiClient } from './zoom-api.client';

jest.mock('../http', () => ({
  fetchWithTimeout: jest.fn(),
}));

import { fetchWithTimeout } from '../http';

const mockedFetch = fetchWithTimeout as jest.Mock;

describe('ZoomApiClient', () => {
  let client: ZoomApiClient;

  beforeEach(async () => {
    mockedFetch.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZoomApiClient],
    }).compile();
    client = module.get<ZoomApiClient>(ZoomApiClient);
    client.onModuleInit();
  });

  afterEach(() => {
    client.onModuleDestroy();
  });

  describe('getAccessToken', () => {
    it('should return cached token when valid', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'cached-token', expires_in: 3600 }),
      });

      // First call primes the cache
      await client.getAccessToken('org-1', 'cid', 'csec', 'acc');
      mockedFetch.mockClear();

      // Second call should hit cache
      const token = await client.getAccessToken('org-1', 'cid', 'csec', 'acc');
      expect(token).toBe('cached-token');
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('should fetch and cache new token', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'new-token', expires_in: 3600 }),
      });

      const token = await client.getAccessToken('org-1', 'cid', 'csec', 'acc');
      expect(token).toBe('new-token');
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('zoom.us/oauth/token'),
        expect.objectContaining({ method: 'POST' }),
        10000,
      );
    });

    it('should throw when auth fails', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 401, text: jest.fn().mockResolvedValue('Unauthorized') });

      await expect(client.getAccessToken('org-1', 'cid', 'csec', 'acc')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createMeeting', () => {
    it('should create meeting successfully', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 123, join_url: 'https://j', start_url: 'https://s' }),
      });

      const result = await client.createMeeting('token', { topic: 'Test', startTime: '2026-01-01T10:00:00Z', durationMins: 30 }, 'Asia/Riyadh');
      expect(result.id).toBe(123);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/users/me/meetings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"topic":"Test"'),
        }),
        10000,
      );
    });

    it('should throw when creation fails', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request', text: jest.fn().mockResolvedValue('error') });

      await expect(client.createMeeting('token', { topic: 'Test', startTime: '2026-01-01T10:00:00Z', durationMins: 30 }, 'UTC')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteMeeting', () => {
    it('should delete meeting successfully', async () => {
      mockedFetch.mockResolvedValue({ ok: true, status: 204 });
      await expect(client.deleteMeeting('token', '123')).resolves.toBeUndefined();
    });

    it('should swallow 404', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 404, text: jest.fn().mockResolvedValue('Not found') });
      await expect(client.deleteMeeting('token', '123')).resolves.toBeUndefined();
    });

    it('should log error on other failures', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 500, text: jest.fn().mockResolvedValue('Server error') });
      await expect(client.deleteMeeting('token', '123')).resolves.toBeUndefined();
    });
  });

  describe('updateMeeting', () => {
    it('should update with all fields', async () => {
      mockedFetch.mockResolvedValue({ ok: true });
      await client.updateMeeting('token', '123', { topic: 'New', startTime: '2026-01-01T11:00:00Z', durationMins: 45 }, 'UTC');
      const body = JSON.parse(mockedFetch.mock.calls[0][1].body);
      expect(body).toEqual({ topic: 'New', start_time: '2026-01-01T11:00:00Z', duration: 45, timezone: 'UTC' });
    });

    it('should update with partial fields', async () => {
      mockedFetch.mockResolvedValue({ ok: true });
      await client.updateMeeting('token', '123', { topic: 'Only topic' }, '');
      const body = JSON.parse(mockedFetch.mock.calls[0][1].body);
      expect(body).toEqual({ topic: 'Only topic' });
    });

    it('should log error on failure', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 404, text: jest.fn().mockResolvedValue('Not found') });
      await expect(client.updateMeeting('token', '123', {}, 'UTC')).resolves.toBeUndefined();
    });
  });

  describe('fetchWithRetry', () => {
    it('should retry on 429 and succeed', async () => {
      mockedFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ id: 1 }) });

      const result = await (client as any).fetchWithRetry('https://api.zoom.us/v2/test', {});
      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
    });

    it('should retry on 5xx and succeed', async () => {
      mockedFetch
        .mockResolvedValueOnce({ ok: false, status: 502 })
        .mockResolvedValueOnce({ ok: true });

      const result = await (client as any).fetchWithRetry('https://api.zoom.us/v2/test', {});
      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
    });

    it('should retry on network error and succeed', async () => {
      mockedFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      const result = await (client as any).fetchWithRetry('https://api.zoom.us/v2/test', {});
      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
    });

    it('should throw after exhausting retries on 429', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 429 });

      const result = await (client as any).fetchWithRetry('https://api.zoom.us/v2/test', {});
      expect(result.status).toBe(429);
      expect(mockedFetch).toHaveBeenCalledTimes(4);
    });

    it('should throw after exhausting retries on network errors', async () => {
      mockedFetch.mockRejectedValue(new Error('Network fail'));

      await expect((client as any).fetchWithRetry('https://api.zoom.us/v2/test', {})).rejects.toThrow('Network fail');
      expect(mockedFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('invalidateToken', () => {
    it('should remove cached tokens for org', () => {
      (client as any).tokenCache.set('org-1:fp1', { token: 't1', expiresAt: Infinity });
      (client as any).tokenCache.set('org-1:fp2', { token: 't2', expiresAt: Infinity });
      (client as any).tokenCache.set('org-2:fp1', { token: 't3', expiresAt: Infinity });

      client.invalidateToken('org-1');
      expect((client as any).tokenCache.has('org-1:fp1')).toBe(false);
      expect((client as any).tokenCache.has('org-1:fp2')).toBe(false);
      expect((client as any).tokenCache.has('org-2:fp1')).toBe(true);
    });
  });

  describe('sweep', () => {
    it('should remove expired tokens', () => {
      const now = Date.now();
      (client as any).tokenCache.set('old', { token: 't1', expiresAt: now - 1000 });
      (client as any).tokenCache.set('new', { token: 't2', expiresAt: now + 100000 });

      (client as any).sweep();
      expect((client as any).tokenCache.has('old')).toBe(false);
      expect((client as any).tokenCache.has('new')).toBe(true);
    });
  });
});
