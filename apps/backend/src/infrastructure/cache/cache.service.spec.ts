import { CacheService, REFERENCE_DATA_TTL_SECONDS } from './cache.service';
import { RedisService } from './redis.service';

describe('CacheService', () => {
  let cache: CacheService;
  let client: {
    get: jest.Mock;
    set: jest.Mock;
    scan: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(() => {
    client = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      scan: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };
    const redis = { getClient: () => client } as unknown as RedisService;
    cache = new CacheService(redis);
  });

  describe('getOrSet', () => {
    it('returns parsed value on cache hit without calling loader', async () => {
      client.get.mockResolvedValue(JSON.stringify([{ id: 'a' }]));
      const loader = jest.fn();

      const result = await cache.getOrSet('k', loader);

      expect(result).toEqual([{ id: 'a' }]);
      expect(loader).not.toHaveBeenCalled();
      expect(client.set).not.toHaveBeenCalled();
    });

    it('runs loader and writes with default TTL on cache miss', async () => {
      client.get.mockResolvedValue(null);
      const loader = jest.fn().mockResolvedValue({ id: 'b' });

      const result = await cache.getOrSet('k', loader);

      expect(result).toEqual({ id: 'b' });
      expect(loader).toHaveBeenCalledTimes(1);
      expect(client.set).toHaveBeenCalledWith(
        'k',
        JSON.stringify({ id: 'b' }),
        'EX',
        REFERENCE_DATA_TTL_SECONDS,
      );
    });

    it('honors a custom TTL', async () => {
      client.get.mockResolvedValue(null);
      await cache.getOrSet('k', async () => 1, 60);
      expect(client.set).toHaveBeenCalledWith('k', '1', 'EX', 60);
    });

    it('falls through to loader when Redis read throws (best-effort)', async () => {
      client.get.mockRejectedValue(new Error('redis down'));
      const loader = jest.fn().mockResolvedValue('fresh');

      const result = await cache.getOrSet('k', loader);

      expect(result).toBe('fresh');
      expect(loader).toHaveBeenCalled();
    });

    it('still returns loader value when Redis write throws', async () => {
      client.get.mockResolvedValue(null);
      client.set.mockRejectedValue(new Error('redis down'));

      const result = await cache.getOrSet('k', async () => 'value');

      expect(result).toBe('value');
    });
  });

  describe('invalidatePrefix', () => {
    it('SCANs and deletes all matching keys across cursor pages', async () => {
      client.scan
        .mockResolvedValueOnce(['7', ['ref:services:1', 'ref:services:2']])
        .mockResolvedValueOnce(['0', ['ref:services:3']]);

      await cache.invalidatePrefix('ref:services:');

      expect(client.scan).toHaveBeenCalledTimes(2);
      expect(client.del).toHaveBeenCalledWith('ref:services:1', 'ref:services:2');
      expect(client.del).toHaveBeenCalledWith('ref:services:3');
    });

    it('does not call del when no keys match', async () => {
      client.scan.mockResolvedValue(['0', []]);
      await cache.invalidatePrefix('ref:nothing:');
      expect(client.del).not.toHaveBeenCalled();
    });

    it('swallows SCAN errors (best-effort, never throws)', async () => {
      client.scan.mockRejectedValue(new Error('redis down'));
      await expect(cache.invalidatePrefix('ref:services:')).resolves.toBeUndefined();
    });
  });
});
