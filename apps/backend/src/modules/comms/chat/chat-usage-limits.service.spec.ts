import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { ChatDailyBudgetExceeded, ChatUsageLimitsService } from './chat-usage-limits.service';

describe('ChatUsageLimitsService', () => {
  const secret = 'test-chat-limit-hmac-secret-with-32-bytes';
  let client: { eval: jest.Mock };
  let service: ChatUsageLimitsService;

  beforeEach(() => {
    client = {
      eval: jest.fn().mockResolvedValue(1),
    };
    const redis = {
      getClient: jest.fn(() => client),
    } as unknown as RedisService;
    const values: Record<string, unknown> = {
      CHAT_GUEST_TOKEN_SECRET: secret,
      CHAT_RATE_LIMIT_PER_MINUTE: 2,
      CHAT_DAILY_TOKEN_BUDGET: 1_000,
    };
    const config = {
      getOrThrow: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    service = new ChatUsageLimitsService(redis, config);
  });

  it('increments independent identity and IP minute windows without putting raw identifiers in Redis keys', async () => {
    await service.consumeMessage({
      identity: 'client:client-sensitive-123',
      ipAddress: '203.0.113.42',
    });

    expect(client.eval).toHaveBeenCalledTimes(2);
    const identityKey = client.eval.mock.calls[0][2] as string;
    const ipKey = client.eval.mock.calls[1][2] as string;
    expect(identityKey).toMatch(/^chat:rate:identity:[a-f0-9]{64}$/);
    expect(ipKey).toMatch(/^chat:rate:ip:[a-f0-9]{64}$/);
    expect(`${identityKey}${ipKey}`).not.toContain('client-sensitive-123');
    expect(`${identityKey}${ipKey}`).not.toContain('203.0.113.42');
  });

  it('rejects when either the opaque identity or IP exceeds the minute limit', async () => {
    client.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

    const error = await service
      .consumeMessage({
        identity: 'guest:opaque-token-hash',
        ipAddress: '198.51.100.8',
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('atomically reserves the remaining daily budget under an opaque UTC-day key before a provider call', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
    try {
      client.eval.mockResolvedValueOnce(1_000);

      const reservation = await service.reserveDailyTokenBudget('client:client-sensitive-123');

      const call = client.eval.mock.calls[0];
      expect(call[2]).toMatch(/^chat:tokens:2026-08-14:[a-f0-9]{64}$/);
      expect(call[2]).not.toContain('client-sensitive-123');
      expect(call.slice(3)).toEqual(['1000', '43200']);
      expect(reservation.reservedTokens).toBe(1_000);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects the second concurrent reservation before it can call a provider', async () => {
    client.eval.mockResolvedValueOnce(1_000).mockResolvedValueOnce(0);

    const first = service.reserveDailyTokenBudget('guest:opaque-token-hash');
    const second = service.reserveDailyTokenBudget('guest:opaque-token-hash');

    await expect(first).resolves.toEqual(expect.objectContaining({ reservedTokens: 1_000 }));
    await expect(second).rejects.toBeInstanceOf(ChatDailyBudgetExceeded);
  });

  it('reconciles a reservation to actual provider tokens without exposing the raw identity', async () => {
    client.eval.mockResolvedValueOnce(1_000).mockResolvedValueOnce(12);
    const reservation = await service.reserveDailyTokenBudget('client:client-sensitive-123');

    await service.settleDailyTokenReservation(reservation, 12);

    const settle = client.eval.mock.calls[1];
    expect(settle[2]).toMatch(/^chat:tokens:2026-08-14:[a-f0-9]{64}$/);
    expect(settle.slice(3)).toEqual(['1000', '12']);
  });
});
