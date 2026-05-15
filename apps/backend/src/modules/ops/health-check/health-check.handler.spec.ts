import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { HealthCheckHandler } from './health-check.handler';

describe('HealthCheckHandler', () => {
  let handler: HealthCheckHandler;
  let health: any;
  let prismaIndicator: any;
  let prisma: any;
  let redis: any;
  let bullMq: any;
  let minio: any;

  beforeEach(async () => {
    health = { check: jest.fn().mockImplementation((checks) => {
      const results: Record<string, any> = {};
      for (const check of checks) {
        const result = check();
        if (result && typeof result === 'object' && 'then' in result) {
          result.then((r: any) => Object.assign(results, r)).catch((e: any) => {
            Object.assign(results, { error: { status: 'down', message: e.message } });
          });
        } else {
          Object.assign(results, result);
        }
      }
      return Promise.resolve(results);
    }) };
    prismaIndicator = { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };
    prisma = {};
    redis = { getClient: jest.fn() };
    bullMq = { getQueue: jest.fn() };
    minio = { ping: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthCheckHandler,
        { provide: HealthCheckService, useValue: health },
        { provide: PrismaHealthIndicator, useValue: prismaIndicator },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: BullMqService, useValue: bullMq },
        { provide: MinioService, useValue: minio },
      ],
    }).compile();

    handler = module.get<HealthCheckHandler>(HealthCheckHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should return health check result', async () => {
    const mockClient = { ping: jest.fn().mockResolvedValue('PONG') };
    redis.getClient.mockReturnValue(mockClient);
    const mockQueue = { getJobCounts: jest.fn().mockResolvedValue({ waiting: 1, active: 0 }) };
    bullMq.getQueue.mockReturnValue(mockQueue);
    minio.ping.mockResolvedValue(undefined);

    const result = await handler.execute();
    expect(result).toBeDefined();
    expect(prismaIndicator.pingCheck).toHaveBeenCalledWith('database', prisma);
  });

  it('should handle redis down', async () => {
    const mockClient = { ping: jest.fn().mockRejectedValue(new Error('Redis down')) };
    redis.getClient.mockReturnValue(mockClient);
    const mockQueue = { getJobCounts: jest.fn().mockResolvedValue({}) };
    bullMq.getQueue.mockReturnValue(mockQueue);
    minio.ping.mockResolvedValue(undefined);

    const result = await handler.execute();
    expect(result).toBeDefined();
  });

  it('should handle bullmq down', async () => {
    const mockClient = { ping: jest.fn().mockResolvedValue('PONG') };
    redis.getClient.mockReturnValue(mockClient);
    const mockQueue = { getJobCounts: jest.fn().mockRejectedValue(new Error('Queue error')) };
    bullMq.getQueue.mockReturnValue(mockQueue);
    minio.ping.mockResolvedValue(undefined);

    const result = await handler.execute();
    expect(result).toBeDefined();
  });

  it('should handle minio down', async () => {
    const mockClient = { ping: jest.fn().mockResolvedValue('PONG') };
    redis.getClient.mockReturnValue(mockClient);
    const mockQueue = { getJobCounts: jest.fn().mockResolvedValue({}) };
    bullMq.getQueue.mockReturnValue(mockQueue);
    minio.ping.mockRejectedValue(new Error('Minio down'));

    const result = await handler.execute();
    expect(result).toBeDefined();
  });
});
