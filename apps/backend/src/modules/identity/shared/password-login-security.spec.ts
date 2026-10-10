import { consumeClientPasswordAttempt, countClientPasswordAttempt } from './password-login-security';

describe('client password admission receipt', () => {
  let counters: Map<string, number>;
  let redis: any;
  beforeEach(() => {
    counters = new Map();
    redis = {
      multi: () => {
        let key = '';
        const pipeline = {
          incr: (value: string) => { key = value; return pipeline; },
          expire: () => pipeline,
          exec: async () => {
            const count = (counters.get(key) ?? 0) + 1;
            counters.set(key, count);
            return [[null, count], [null, 1]];
          },
        };
        return pipeline;
      },
    };
  });

  it('consumes once without counting identifier or IP twice', async () => {
    const attempt = await countClientPasswordAttempt(redis, 'client@example.com', 'ip-1');
    expect(await consumeClientPasswordAttempt(attempt, redis, 'client@example.com', 'ip-1'))
      .toEqual({ identifierAttempts: 1, identifierKey: 'client_login:id:client@example.com', ipKey: 'client_login:ip:ip-1' });
    await expect(consumeClientPasswordAttempt(attempt, redis, 'client@example.com', 'ip-1')).rejects.toThrow('Invalid credentials');
    expect(counters.get('client_login:ip:ip-1')).toBe(1);
    expect(counters.get('client_login:id:client@example.com')).toBe(1);
  });

  it('rejects concurrent replay before any alias counting', async () => {
    const attempt = await countClientPasswordAttempt(redis, 'email@example.com', 'ip-1');
    const results = await Promise.allSettled([
      consumeClientPasswordAttempt(attempt, redis, '+966501234567', 'ip-1'),
      consumeClientPasswordAttempt(attempt, redis, '+966501234567', 'ip-1'),
    ]);
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(counters.get('client_login:id:+966501234567')).toBe(1);
    expect(counters.get('client_login:ip:ip-1')).toBe(1);
  });

  it('rejects a forged receipt without changing counters', async () => {
    await expect(consumeClientPasswordAttempt({ receipt: {}, identifierAttempts: 1, identifierKey: 'fake', ipKey: 'fake' }, redis, 'client@example.com', 'ip-1'))
      .rejects.toThrow('Invalid credentials');
    expect(counters.size).toBe(0);
  });

  it.each(['ip', 'redis'])('binds receipt to its %s and burns it on mismatch', async (binding) => {
    const attempt = await countClientPasswordAttempt(redis, 'client@example.com', 'ip-1');
    await expect(consumeClientPasswordAttempt(attempt, binding === 'redis' ? { ...redis } : redis, 'client@example.com', binding === 'ip' ? 'ip-2' : 'ip-1'))
      .rejects.toThrow('Invalid credentials');
    await expect(consumeClientPasswordAttempt(attempt, redis, 'client@example.com', 'ip-1')).rejects.toThrow('Invalid credentials');
    expect(counters.get('client_login:ip:ip-1')).toBe(1);
  });

  it('uses authoritative stored counts rather than mutable exposed fields', async () => {
    counters.set('client_login:id:client@example.com', 3);
    const attempt = await countClientPasswordAttempt(redis, 'client@example.com', 'ip-1');
    Object.assign(attempt, { identifierAttempts: 0, identifierKey: 'forged', ipKey: 'forged' });
    expect(await consumeClientPasswordAttempt(attempt, redis, 'client@example.com', 'ip-1'))
      .toEqual({ identifierAttempts: 4, identifierKey: 'client_login:id:client@example.com', ipKey: 'client_login:ip:ip-1' });
  });

  it('preserves the canonical alias budget without recounting IP', async () => {
    counters.set('client_login:id:+966501234567', 5);
    const attempt = await countClientPasswordAttempt(redis, 'email@example.com', 'ip-1');
    await expect(consumeClientPasswordAttempt(attempt, redis, '+966501234567', 'ip-1')).rejects.toThrow('Invalid credentials');
    expect(counters.get('client_login:id:+966501234567')).toBe(6);
    expect(counters.get('client_login:id:email@example.com')).toBe(1);
    expect(counters.get('client_login:ip:ip-1')).toBe(1);
  });

  it.each([null, [[new Error('Redis error'), null], [null, 1]], [[null, '1'], [null, 1]], [[null, 0], [null, 1]], [[null, 1], [new Error('Expire error'), null]]])('fails closed on invalid Redis transaction result %j', async (result) => {
      const exec = jest.fn().mockResolvedValue(result);
      const pipeline = { incr: () => pipeline, expire: () => pipeline, exec };
      redis.multi = () => pipeline;
      await expect(countClientPasswordAttempt(redis, 'client@example.com', 'ip-1')).rejects.toThrow('Invalid credentials');
    });
});
