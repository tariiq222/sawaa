import { UnauthorizedException } from '@nestjs/common';
import { DashboardTwoFactorChallengeService } from './dashboard-two-factor-challenge.service';
import { RedisService } from '../../infrastructure/cache/redis.service';

describe('DashboardTwoFactorChallengeService', () => {
  const redisClient = { set: jest.fn(), get: jest.fn(), eval: jest.fn() };
  const service = new DashboardTwoFactorChallengeService({ getClient: () => redisClient } as unknown as RedisService);

  beforeEach(() => jest.clearAllMocks());

  it('stores only the bound identity under a short-lived opaque UUID', async () => {
    redisClient.set.mockResolvedValue('OK');
    const challenge = await service.create('user-1', 'admin@sawaa.app');
    expect(challenge).toMatch(/^[0-9a-f-]{36}$/i);
    expect(redisClient.set).toHaveBeenCalledWith(
      `dashboard_2fa:challenge:${challenge}`,
      JSON.stringify({ userId: 'user-1', identifier: 'admin@sawaa.app' }),
      'EX',
      300,
    );
  });

  it('rejects a challenge bound to another identity', async () => {
    redisClient.get.mockResolvedValue(JSON.stringify({ userId: 'user-1', identifier: 'admin@sawaa.app' }));
    await expect(service.assertValid('challenge', 'user-2', 'admin@sawaa.app')).rejects.toThrow(UnauthorizedException);
  });

  it('consumes the exact bound challenge atomically', async () => {
    redisClient.eval.mockResolvedValue(1);
    await expect(service.consume('challenge', 'user-1', 'admin@sawaa.app')).resolves.toBeUndefined();
    expect(redisClient.eval).toHaveBeenCalledWith(expect.any(String), 1, 'dashboard_2fa:challenge:challenge', JSON.stringify({ userId: 'user-1', identifier: 'admin@sawaa.app' }));
  });
});
