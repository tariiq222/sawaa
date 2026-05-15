import { ZoomApiClient } from './zoom-api.client';
import * as fetchModule from '../http/fetch-with-timeout';

describe('ZoomApiClient', () => {
  let client: ZoomApiClient;

  beforeEach(() => {
    client = new ZoomApiClient();
    client.onModuleInit();
  });

  afterEach(() => {
    client.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('should get access token from zoom', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-123', expires_in: 3600 }),
    } as any);
    const token = await client.getAccessToken('org-1', 'client-id', 'client-secret', 'account-id');
    expect(token).toBe('token-123');
  });

  it('should use cached token', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-123', expires_in: 3600 }),
    } as any);
    await client.getAccessToken('org-1', 'client-id', 'client-secret', 'account-id');
    const token = await client.getAccessToken('org-1', 'client-id', 'client-secret', 'account-id');
    expect(token).toBe('token-123');
    expect(fetchModule.fetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('should throw on auth failure', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as any);
    await expect(client.getAccessToken('org-1', 'client-id', 'client-secret', 'account-id')).rejects.toThrow();
  });

  it('should create meeting', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 123, join_url: 'https://zoom.us/j/123', start_url: 'https://zoom.us/s/123' }),
    } as any);
    const meeting = await client.createMeeting('token', { topic: 'Test', startTime: '2024-01-01T10:00:00Z', durationMins: 30 }, 'Asia/Riyadh');
    expect(meeting.id).toBe(123);
  });

  it('should throw on create meeting failure', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Bad Request',
    } as any);
    await expect(client.createMeeting('token', { topic: 'Test', startTime: '2024-01-01T10:00:00Z', durationMins: 30 }, 'Asia/Riyadh')).rejects.toThrow();
  });

  it('should delete meeting', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 204,
    } as any);
    await expect(client.deleteMeeting('token', '123')).resolves.not.toThrow();
  });

  it('should not throw on 404 delete', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    } as any);
    await expect(client.deleteMeeting('token', '123')).resolves.not.toThrow();
  });

  it('should update meeting', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 204,
    } as any);
    await expect(client.updateMeeting('token', '123', { topic: 'Updated' }, 'Asia/Riyadh')).resolves.not.toThrow();
  });

  it('should invalidate token', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-123', expires_in: 3600 }),
    } as any);
    await client.getAccessToken('org-1', 'client-id', 'client-secret', 'account-id');
    client.invalidateToken('org-1');
    await client.getAccessToken('org-1', 'client-id', 'client-secret', 'account-id');
    expect(fetchModule.fetchWithTimeout).toHaveBeenCalledTimes(2);
  });
});
