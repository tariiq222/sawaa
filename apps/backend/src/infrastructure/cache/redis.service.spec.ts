import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});
import 'ioredis';

describe('RedisService', () => {
  let service: RedisService;
  let config: any;

  beforeEach(async () => {
    config = {
      get: jest.fn(),
      getOrThrow: jest.fn((key) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return undefined;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(RedisService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('should ping on init', async () => {
    await service.onModuleInit();
    const client = (service as any).client;
    expect(client.ping).toHaveBeenCalled();
  });

  it('should quit on destroy', async () => {
    await service.onModuleDestroy();
    const client = (service as any).client;
    expect(client.quit).toHaveBeenCalled();
  });

  it('should return client', () => {
    const client = service.getClient();
    expect(client).toBeDefined();
  });

  it('should build options with password when set', () => {
    config.get.mockImplementation((key) => {
      if (key === 'REDIS_PASSWORD') return 'secret';
      return undefined;
    });
    const opts = service.buildOptions();
    expect(opts.host).toBe('localhost');
    expect(opts.password).toBe('secret');
    expect(opts.db).toBe(0);
  });

  it('should omit password when empty', () => {
    config.get.mockReturnValue('');
    const opts = service.buildOptions();
    expect(opts.password).toBeUndefined();
  });

  it('should omit password when null', () => {
    config.get.mockReturnValue(null);
    const opts = service.buildOptions();
    expect(opts.password).toBeUndefined();
  });

  it('should use custom db when set', () => {
    config.get.mockImplementation((key) => {
      if (key === 'REDIS_DB') return 3;
      return key === 'REDIS_PASSWORD' ? null : undefined;
    });
    const opts = service.buildOptions();
    expect(opts.db).toBe(3);
  });
});
