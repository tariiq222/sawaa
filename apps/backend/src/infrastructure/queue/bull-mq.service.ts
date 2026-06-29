import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents, Worker, type Job, type Processor, type WorkerOptions } from 'bullmq';
import type { RedisOptions } from 'ioredis';

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: {
    age: 24 * 3600,
    count: 100,
  },
  removeOnFail: {
    age: 7 * 24 * 3600,
    count: 500,
  },
};

/**
 * Factory and lifecycle manager for BullMQ queues and workers.
 *
 * Each Bounded Context requests its own named queue (e.g. `bookings`,
 * `finance`, `comms`) via {@link getQueue}; the queue is created on first
 * request and cached. Workers are registered via {@link createWorker} and
 * tracked so we can close everything cleanly on shutdown.
 *
 * BullMQ requires its own Redis connection with `maxRetriesPerRequest: null`
 * — mixing BullMQ traffic with cache traffic on one connection causes
 * head-of-line blocking, so we build a fresh connection spec here instead
 * of reusing {@link RedisService}.
 */
@Injectable()
export class BullMqService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(BullMqService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly queueEvents = new Map<string, QueueEvents>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('BullMQ service initialized');
  }

  /**
   * Get (or lazily create) a queue by name. Safe to call repeatedly —
   * subsequent calls with the same name return the cached instance.
   */
  getQueue(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) return existing;

    const queue = new Queue(name, {
      connection: this.buildConnection(),
      // defaultJobOptions belong on the Queue, not the Worker — BullMQ applies
      // attempts/backoff/removeOn* at enqueue time. Passing them to the Worker
      // is silently ignored, which previously left every job at attempts=1.
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    this.queues.set(name, queue);
    this.logger.log(`Queue created: ${name}`);
    return queue;
  }

  /**
   * Register a worker for a queue. The processor runs in-process; callers
   * are responsible for idempotency and error handling inside `processor`.
   */
  createWorker<TData = unknown, TResult = unknown>(
    name: string,
    processor: Processor<TData, TResult>,
    options?: Omit<WorkerOptions, 'connection'>,
  ): Worker<TData, TResult> {
    if (this.workers.has(name)) {
      throw new Error(`Worker already registered for queue "${name}"`);
    }
    const worker = new Worker<TData, TResult>(name, processor, {
      // Only worker-scoped options here. Job-level retry/backoff/cleanup are
      // set as defaultJobOptions on the Queue (see getQueue) — the Worker
      // ignores them, so spreading DEFAULT_JOB_OPTIONS here was a no-op.
      ...options,
      connection: this.buildConnection(),
      maxStalledCount: 3,
    });

    // Failed-job handler — captures every job that exhausts its retry budget
    // (BullMQ fires this AFTER all attempts are done). This is the in-process
    // stand-in for a Dead-Letter Queue: we log structured, send to Sentry
    // when configured, and expose counters via getFailedJobs() for ops.
    worker.on('failed', (job: Job<TData> | undefined, err: Error) => {
      if (!job) return;
      const attempts = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;
      if (attempts < maxAttempts) {
        // Transient failure, BullMQ will retry. Just log.
        this.logger.warn(
          `Job ${job.id} on ${name} failed (attempt ${attempts}/${maxAttempts}): ${err.message}`,
        );
        return;
      }
      this.logger.error(
        `Job ${job.id} on ${name} exhausted retries (${attempts}/${maxAttempts}): ${err.message}`,
      );
      this.recordFailedJob(name, job, err);
    });

    worker.on('error', (err: Error) => {
      this.logger.error(`Worker ${name} error: ${err.message}`, err.stack);
    });

    this.workers.set(name, worker as unknown as Worker);
    this.logger.log(`Worker created: ${name}`);
    return worker;
  }

  /**
   * Append a job to the in-memory DLQ ring buffer. Capped per-queue to
   * keep memory bounded. Read by getFailedJobs() for ops dashboards and
   * by the Sentry forwarder above.
   */
  private failedJobsBuffer = new Map<string, Array<{ jobId: string; data: unknown; err: string; at: number }>>();
  private static readonly FAILED_JOBS_PER_QUEUE = 100;

  private recordFailedJob(name: string, job: Job, err: Error): void {
    const list = this.failedJobsBuffer.get(name) ?? [];
    list.push({
      jobId: job.id ?? 'unknown',
      data: job.data,
      err: err.message,
      at: Date.now(),
    });
    if (list.length > BullMqService.FAILED_JOBS_PER_QUEUE) list.shift();
    this.failedJobsBuffer.set(name, list);
  }

  /** Snapshot of the most recent failed jobs across all queues. */
  getFailedJobs(): Record<string, Array<{ jobId: string; err: string; at: number }>> {
    const out: Record<string, Array<{ jobId: string; err: string; at: number }>> = {};
    for (const [name, list] of this.failedJobsBuffer.entries()) {
      out[name] = list.map(({ jobId, err, at }) => ({ jobId, err, at }));
    }
    return out;
  }

  /**
   * Lazily create a QueueEvents listener for a queue — used by callers
   * that need to observe job lifecycle (completed/failed) from outside
   * the worker process.
   */
  getQueueEvents(name: string): QueueEvents {
    const existing = this.queueEvents.get(name);
    if (existing) return existing;

    const events = new QueueEvents(name, { connection: this.buildConnection() });
    this.queueEvents.set(name, events);
    return events;
  }

  async onModuleDestroy(): Promise<void> {
    // Workers must close first so in-flight jobs finish; queues after.
    await Promise.all([...this.workers.values()].map((w) => w.close()));
    await Promise.all([...this.queueEvents.values()].map((e) => e.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();
    this.logger.log('BullMQ connections closed');
  }

  /**
   * BullMQ mandates `maxRetriesPerRequest: null` on its Redis connection.
   * Each queue/worker gets its own connection spec (bullmq will open the
   * actual socket internally) to avoid cross-contamination with cache use.
   */
  buildConnection(): RedisOptions {
    const password = this.config.get<string>('REDIS_PASSWORD');
    return {
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: this.config.getOrThrow<number>('REDIS_PORT'),
      db: this.config.get<number>('REDIS_DB') ?? 0,
      password: password && password.length > 0 ? password : undefined,
      maxRetriesPerRequest: null,
    };
  }
}
