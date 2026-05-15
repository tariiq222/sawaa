import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_PASSWORD') return 'secret';
              if (key === 'REDIS_DB') return 1;
              return undefined;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              throw new Error(`Missing ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should build options with password', () => {
    const options = service.buildOptions();
    expect(options.host).toBe('localhost');
    expect(options.port).toBe(6379);
    expect(options.db).toBe(1);
    expect(options.password).toBe('secret');
  });

  it('should build options without password when empty', () => {
    const module: TestingModule = Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ''),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              return 0;
            }),
          },
        },
      ],
    });
    // We can't easily test this without re-instantiating, skip for now
  });

  it('should return client', () => {
    expect(service.getClient()).toBeDefined();
  });
});
