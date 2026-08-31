import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { ChatDailyBudgetExceeded, ChatUsageLimitsService } from './chat-usage-limits.service';

describe('ChatUsageLimitsService', () => {
  const secret = 'test-chat-limit-hmac-secret-with-32-bytes';
  let client: { eval: jest.Mock; get: jest.Mock };
  let service: ChatUsageLimitsService;

  beforeEach(() => {
    client = {
      eval: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
    };
    const redis = {
      getClient: jest.fn(() => client),
    } as unknown as RedisService;
    const values: Record<string, unknown> = {
      CHAT_GUEST_TOKEN_SECRET: secret,
      CHAT_RATE_LIMIT_PER_MINUTE: 2,
      CHAT_DAILY_TOKEN_BUDGET: 1_000,
      CHAT_DAILY_TOKEN_BUDGET_PER_IP: 1_000,
      CHAT_DAILY_TOKEN_BUDGET_GLOBAL: 2_000,
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

    expect(client.eval).toHaveBeenCalledTimes(1);
    const identityKey = client.eval.mock.calls[0][2] as string;
    const ipKey = client.eval.mock.calls[0][3] as string;
    const bindKey = client.eval.mock.calls[0][4] as string;
    const bindValue = client.eval.mock.calls[0][7] as string;
    expect(identityKey).toMatch(/^chat:rate:identity:[a-f0-9]{64}$/);
    expect(ipKey).toMatch(/^chat:rate:ip:[a-f0-9]{64}$/);
    expect(bindKey).toMatch(/^chat:ip-bind:[a-f0-9]{64}$/);
    expect(bindValue).toMatch(/^[a-f0-9]{64}$/);
    expect(`${identityKey}${ipKey}${bindKey}${bindValue}`).not.toContain('client-sensitive-123');
    expect(`${identityKey}${ipKey}${bindKey}${bindValue}`).not.toContain('203.0.113.42');
  });

  it('rejects when either the opaque identity or IP exceeds the minute limit', async () => {
    client.eval.mockResolvedValueOnce(0);

    const error = await service
      .consumeMessage({
        identity: 'guest:opaque-token-hash',
        ipAddress: '198.51.100.8',
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  // Daily-budget keys embed the UTC calendar day from `new Date()`. Freeze
  // the clock for every reservation/settle case so assertions on
  // `chat:tokens:<UTC-date>:<64-hex>` cannot drift with the real calendar.
  // Nested beforeEach/afterEach (not a file-wide fake-timer) keeps the
  // minute-window tests on real timers and always restores them.
  describe('daily token budget', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('atomically reserves a defined request allowance under an opaque UTC-day key before a provider call', async () => {
      client.eval.mockResolvedValueOnce(500);

      const reservation = await service.reserveDailyTokenBudget('client:client-sensitive-123', 500);

      const call = client.eval.mock.calls[0];
      expect(call[1]).toBe(2);
      expect(call[2]).toMatch(/^chat:tokens:2026-08-14:[a-f0-9]{64}$/);
      expect(call[2]).not.toContain('client-sensitive-123');
      expect(call[3]).toBe('chat:tokens:global:2026-08-14');
      expect(call.slice(4)).toEqual(['1000', '2000', '500', '43200']);
      expect(reservation.reservedTokens).toBe(500);
      expect(reservation.globalKey).toBe('chat:tokens:global:2026-08-14');
    });

    it('rejects the second concurrent reservation before it can call a provider', async () => {
      client.eval.mockResolvedValueOnce(500).mockResolvedValueOnce(0);

      const first = service.reserveDailyTokenBudget('guest:opaque-token-hash', 500);
      const second = service.reserveDailyTokenBudget('guest:opaque-token-hash', 500);

      await expect(first).resolves.toEqual(expect.objectContaining({ reservedTokens: 500 }));
      await expect(second).rejects.toBeInstanceOf(ChatDailyBudgetExceeded);
    });

    it('reconciles a reservation to actual provider tokens without exposing the raw identity', async () => {
      client.eval.mockResolvedValueOnce(500).mockResolvedValueOnce(12);
      const reservation = await service.reserveDailyTokenBudget('client:client-sensitive-123', 500);

      await service.settleDailyTokenReservation(reservation, 12);

      const settle = client.eval.mock.calls[1];
      expect(settle[1]).toBe(2);
      expect(settle[2]).toMatch(/^chat:tokens:2026-08-14:[a-f0-9]{64}$/);
      expect(settle[2]).not.toContain('client-sensitive-123');
      expect(settle[3]).toBe('chat:tokens:global:2026-08-14');
      expect(settle.slice(4)).toEqual(['500', '12']);
    });

    it('does not settle an actual total above its reservation, retaining the capped allowance', async () => {
      client.eval.mockResolvedValueOnce(500);
      const reservation = await service.reserveDailyTokenBudget('client:client-sensitive-123', 500);

      await service.settleDailyTokenReservation(reservation, 501);

      expect(client.eval).toHaveBeenCalledTimes(1);
    });

    it('refuses a near-cap allowance before any provider work can start', async () => {
      client.eval.mockResolvedValueOnce(0);

      await expect(service.reserveDailyTokenBudget('client:client-sensitive-123', 1_000))
        .rejects.toBeInstanceOf(ChatDailyBudgetExceeded);
    });

    it('does not grant a fresh daily budget when a second identity shares an exhausted IP', async () => {
      client.eval.mockResolvedValueOnce(600).mockResolvedValueOnce(0);

      await expect(service.reserveDailyTokenBudget('guest:identity-a', 600, '203.0.113.42'))
        .resolves.toEqual(expect.objectContaining({ reservedTokens: 600 }));
      await expect(service.reserveDailyTokenBudget('guest:identity-b', 500, '203.0.113.42'))
        .rejects.toBeInstanceOf(ChatDailyBudgetExceeded);

      const first = client.eval.mock.calls[0];
      const second = client.eval.mock.calls[1];
      expect(first[2]).toMatch(/^chat:tokens:2026-08-14:[a-f0-9]{64}$/);
      expect(second[2]).toMatch(/^chat:tokens:2026-08-14:[a-f0-9]{64}$/);
      expect(first[2]).not.toBe(second[2]);
      expect(first[3]).toBe(second[3]);
      expect(first[3]).toMatch(/^chat:tokens:ip:2026-08-14:[a-f0-9]{64}$/);
      expect(first[4]).toBe('chat:tokens:global:2026-08-14');
      expect(second[4]).toBe('chat:tokens:global:2026-08-14');
      expect(`${first[2]}${first[3]}${first[4]}${second[2]}${second[3]}${second[4]}`).not.toContain('203.0.113.42');
      expect(`${first[2]}${first[3]}${first[4]}${second[2]}${second[3]}${second[4]}`).not.toContain('identity-a');
      expect(`${first[2]}${first[3]}${first[4]}${second[2]}${second[3]}${second[4]}`).not.toContain('identity-b');
    });

    it('builds the IP daily-budget key from an opaque HMAC and never embeds the raw IP', async () => {
      client.eval.mockResolvedValueOnce(100);

      const reservation = await service.reserveDailyTokenBudget(
        'guest:opaque-token-hash',
        100,
        '198.51.100.8',
      );

      expect(reservation.ipKey).toMatch(/^chat:tokens:ip:2026-08-14:[a-f0-9]{64}$/);
      expect(reservation.ipKey).not.toContain('198.51.100.8');
      expect(reservation.key).not.toContain('198.51.100.8');
      expect(reservation.globalKey).toBe('chat:tokens:global:2026-08-14');
      expect(client.eval.mock.calls[0][3]).toBe(reservation.ipKey);
      expect(client.eval.mock.calls[0][4]).toBe(reservation.globalKey);
    });

    it('applies the IP cap from the consumeMessage bind when reserve is called without an explicit IP', async () => {
      client.eval
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(400)
        .mockResolvedValueOnce(0);

      await service.consumeMessage({ identity: 'guest:identity-a', ipAddress: '203.0.113.42' });
      await service.consumeMessage({ identity: 'guest:identity-b', ipAddress: '203.0.113.42' });
      const boundA = client.eval.mock.calls[0][7] as string;
      const boundB = client.eval.mock.calls[1][7] as string;
      expect(boundA).toBe(boundB);
      client.get.mockResolvedValueOnce(boundA).mockResolvedValueOnce(boundB);

      await expect(service.reserveDailyTokenBudget('guest:identity-a', 400))
        .resolves.toEqual(expect.objectContaining({ reservedTokens: 400 }));
      await expect(service.reserveDailyTokenBudget('guest:identity-b', 700))
        .rejects.toBeInstanceOf(ChatDailyBudgetExceeded);

      expect(client.eval.mock.calls[2][3]).toBe(`chat:tokens:ip:2026-08-14:${boundA}`);
      expect(client.eval.mock.calls[3][3]).toBe(`chat:tokens:ip:2026-08-14:${boundB}`);
      expect(client.eval.mock.calls[2][3]).not.toContain('203.0.113.42');
    });

    it('refuses a request against the global cap while identity and IP still have headroom', async () => {
      client.eval.mockResolvedValueOnce(-1);

      const error = await service
        .reserveDailyTokenBudget('guest:identity-a', 500, '203.0.113.42')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ChatDailyBudgetExceeded);
      expect((error as ChatDailyBudgetExceeded).scope).toBe('global');
      expect(client.eval).toHaveBeenCalledTimes(1);
      const call = client.eval.mock.calls[0];
      expect(call[1]).toBe(3);
      expect(call[2]).toMatch(/^chat:tokens:2026-08-14:[a-f0-9]{64}$/);
      expect(call[3]).toMatch(/^chat:tokens:ip:2026-08-14:[a-f0-9]{64}$/);
      expect(call[4]).toBe('chat:tokens:global:2026-08-14');
      expect(call.slice(5)).toEqual(['1000', '1000', '2000', '500', '43200']);
      const script = String(call[0]);
      expect(script.indexOf('INCRBY')).toBeGreaterThan(script.indexOf('return -1'));
    });

    it('does not increment identity or IP counters when the global cap refuses', async () => {
      const store = new Map<string, number>();
      client.eval.mockImplementation(async (script: string, numKeys: number, ...args: string[]) => {
        const keys = args.slice(0, numKeys);
        const argv = args.slice(numKeys);
        if (String(script).includes('globalCurrent') && keys.length === 3) {
          const identityCurrent = store.get(keys[0]) ?? 0;
          const ipCurrent = store.get(keys[1]) ?? 0;
          const globalCurrent = store.get(keys[2]) ?? 0;
          const requested = Number(argv[3]);
          if (requested <= 0 || identityCurrent + requested > Number(argv[0]) || ipCurrent + requested > Number(argv[1])) {
            return 0;
          }
          if (globalCurrent + requested > Number(argv[2])) {
            return -1;
          }
          store.set(keys[0], identityCurrent + requested);
          store.set(keys[1], ipCurrent + requested);
          store.set(keys[2], globalCurrent + requested);
          return requested;
        }
        return 0;
      });
      store.set('chat:tokens:global:2026-08-14', 1_600);

      await expect(service.reserveDailyTokenBudget('guest:identity-a', 500, '203.0.113.42'))
        .rejects.toMatchObject({ scope: 'global' });

      const identityKey = client.eval.mock.calls[0][2] as string;
      const ipKey = client.eval.mock.calls[0][3] as string;
      expect(store.has(identityKey)).toBe(false);
      expect(store.has(ipKey)).toBe(false);
      expect(store.get('chat:tokens:global:2026-08-14')).toBe(1_600);
    });

    it('returns unused reserved tokens to the global counter on settlement', async () => {
      const store = new Map<string, number>();
      client.eval.mockImplementation(async (script: string, numKeys: number, ...args: string[]) => {
        const keys = args.slice(0, numKeys);
        const argv = args.slice(numKeys);
        if (String(script).includes('INCRBY') && String(script).includes('globalCurrent')) {
          for (const key of keys) {
            store.set(key, (store.get(key) ?? 0) + Number(argv[keys.length === 3 ? 3 : 2]));
          }
          return Number(argv[keys.length === 3 ? 3 : 2]);
        }
        if (String(script).includes('DECRBY')) {
          const reserved = Number(argv[0]);
          const actual = Number(argv[1]);
          if (actual >= 0 && actual < reserved) {
            const refund = reserved - actual;
            for (const key of keys) {
              store.set(key, (store.get(key) ?? 0) - refund);
            }
          }
          return store.get(keys[0]) ?? 0;
        }
        return 0;
      });

      const reservation = await service.reserveDailyTokenBudget('guest:identity-a', 500, '203.0.113.42');
      expect(store.get(reservation.globalKey)).toBe(500);

      await service.settleDailyTokenReservation(reservation, 12);

      expect(store.get(reservation.key)).toBe(12);
      expect(store.get(reservation.ipKey ?? '')).toBe(12);
      expect(store.get(reservation.globalKey)).toBe(12);
    });

    it('emits one greppable global-cap warning per UTC day and never logs caller identifiers', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      client.eval.mockResolvedValue(-1);

      await expect(service.reserveDailyTokenBudget('guest:identity-a', 500, '203.0.113.42'))
        .rejects.toMatchObject({ scope: 'global' });
      await expect(service.reserveDailyTokenBudget('guest:identity-b', 500, '198.51.100.8'))
        .rejects.toMatchObject({ scope: 'global' });

      const globalWarns = warn.mock.calls
        .map((call) => String(call[0]))
        .filter((line) => line.includes('CHAT_DAILY_TOKEN_BUDGET_GLOBAL exhausted'));
      expect(globalWarns).toHaveLength(1);
      expect(globalWarns[0]).toContain('utcDay=2026-08-14');
      expect(globalWarns[0]).toContain('ceiling=2000');
      expect(globalWarns.join('')).not.toContain('identity-a');
      expect(globalWarns.join('')).not.toContain('identity-b');
      expect(globalWarns.join('')).not.toContain('203.0.113.42');
      expect(globalWarns.join('')).not.toContain('198.51.100.8');
      warn.mockRestore();
    });

    it('does not emit the global-cap warning when only a caller budget refuses', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      client.eval.mockResolvedValueOnce(0);

      await expect(service.reserveDailyTokenBudget('guest:identity-a', 500, '203.0.113.42'))
        .rejects.toMatchObject({ scope: 'caller' });

      expect(warn.mock.calls.some((call) => String(call[0]).includes('CHAT_DAILY_TOKEN_BUDGET_GLOBAL'))).toBe(false);
      warn.mockRestore();
    });
  });
});
