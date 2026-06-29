import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BullMqService } from './bull-mq.service';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    on: jest.fn(),
  })),
  QueueEvents: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
}));

describe('BullMqService', () => {
  let service: BullMqService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullMqService,
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

    service = module.get<BullMqService>(BullMqService);
  });

  it('should get or create queue', () => {
    const q1 = service.getQueue('test');
    const q2 = service.getQueue('test');
    expect(q1).toBe(q2);
  });

  it('should create worker', () => {
    const worker = service.createWorker('test', jest.fn());
    expect(worker).toBeDefined();
  });

  it('should throw when creating duplicate worker', () => {
    service.createWorker('test', jest.fn());
    expect(() => service.createWorker('test', jest.fn())).toThrow('Worker already registered');
  });

  it('should get or create queue events', () => {
    const e1 = service.getQueueEvents('test');
    const e2 = service.getQueueEvents('test');
    expect(e1).toBe(e2);
  });

  it('should close all on destroy', async () => {
    service.getQueue('q1');
    service.createWorker('w1', jest.fn());
    service.getQueueEvents('e1');
    await expect(service.onModuleDestroy()).resolves.not.toThrow();
  });

  it('should build connection with password', () => {
    const conn = service.buildConnection();
    expect(conn.host).toBe('localhost');
    expect(conn.port).toBe(6379);
    expect(conn.password).toBe('secret');
    expect(conn.maxRetriesPerRequest).toBeNull();
  });

  it('should set defaultJobOptions with attempts>1 and backoff on the Queue', () => {
    const { Queue } = jest.requireMock('bullmq');
    service.getQueue('retryable');

    const [, opts] = Queue.mock.calls.at(-1);
    expect(opts.defaultJobOptions).toBeDefined();
    expect(opts.defaultJobOptions.attempts).toBeGreaterThan(1);
    expect(opts.defaultJobOptions.backoff).toEqual(
      expect.objectContaining({ type: 'exponential' }),
    );
  });

  it('should NOT pass job-level retry options to the Worker (BullMQ ignores them there)', () => {
    const { Worker } = jest.requireMock('bullmq');
    service.createWorker('retryable', jest.fn());

    const [, , workerOpts] = Worker.mock.calls.at(-1);
    // Retry/backoff must live on the Queue, not the Worker.
    expect(workerOpts.attempts).toBeUndefined();
    expect(workerOpts.backoff).toBeUndefined();
    // Worker-scoped options remain.
    expect(workerOpts.maxStalledCount).toBe(3);
  });
});
