import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue, Worker } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { BullMqService } from '../queue/bull-mq.service';
import { SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../common/constants';

export interface DomainEventEnvelope<TPayload = unknown> {
  eventId: string;
  correlationId?: string;
  source: string;
  version: number;
  occurredAt: Date | string;
  payload: TPayload;
}

export type EventHandler<TPayload = unknown> = (
  event: DomainEventEnvelope<TPayload>,
) => Promise<void> | void;

type RegisteredHandler = {
  eventName: string;
  consumerId: string;
  handler: EventHandler;
  queueName: string;
};

type ConsumerJobData = {
  eventName: string;
  event: DomainEventEnvelope;
};

const EVENT_QUEUE_PREFIX = 'domain-events--';
// Kept for a full rolling window. Pods from 1ebce257 publish/consume this
// queue; importantly the bridge below *throws* for an unknown event instead of
// acknowledging it as that version did.
const LEGACY_EVENT_QUEUE = 'domain-events';

/** Signals a rolling worker that it does not yet know how to route an event. */
export class NoEventConsumersRegisteredError extends Error {
  constructor(readonly eventName: string) {
    super(`No event consumers are registered for "${eventName}"`);
  }
}

/**
 * Durable inter-context event bus.
 *
 * Each explicit consumer owns a distinct BullMQ queue. This is the routing
 * boundary: an old process cannot dequeue a job intended for a consumer that
 * only exists in a newer rolling version. Jobs are FIFO per consumer (BullMQ
 * worker concurrency defaults to one), while different consumers progress
 * independently and cannot replay each other's completed work.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlersByEvent = new Map<string, RegisteredHandler[]>();
  private readonly handlersByConsumer = new Map<string, RegisteredHandler>();
  private readonly workers = new Map<string, Worker>();
  private legacyWorker?: Worker;

  constructor(
    private readonly bullmq: BullMqService,
    private readonly cls: ClsService,
  ) {}

  async publish<TPayload>(
    eventName: string,
    event: DomainEventEnvelope<TPayload>,
  ): Promise<void> {
    const consumers = this.handlersByEvent.get(eventName) ?? [];
    if (consumers.length === 0) {
      // Do not acknowledge an outbox row until a compatible rolling version
      // can name its destination queue(s).
      throw new NoEventConsumersRegisteredError(eventName);
    }

    // Registration order is deterministic. Queues remain independent, so a
    // later subscriber failure cannot replay an earlier subscriber.
    for (const consumer of consumers) {
      const queue = this.getQueue(consumer.queueName);
      await queue.add(eventName, {
        eventName,
        event,
      } satisfies ConsumerJobData, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
        // Queue identity already scopes the consumer, so eventId is the stable
        // replay key within that queue.
        jobId: this.safeId(event.eventId, 180),
      });
    }
  }

  /**
   * Publish an observational event when compatible consumers exist.
   *
   * Unlike `publish`, an absent consumer is an intentional no-op. This keeps
   * optional post-commit notifications from turning an already-committed
   * command into an HTTP 500 while preserving strict delivery semantics for
   * required/outbox-backed events.
   */
  async publishOptional<TPayload>(
    eventName: string,
    event: DomainEventEnvelope<TPayload>,
  ): Promise<void> {
    const consumers = this.handlersByEvent.get(eventName) ?? [];
    if (consumers.length === 0) {
      this.logger.debug(`Optional event "${eventName}" has no registered consumers`);
      return;
    }
    await this.publish(eventName, event);
  }

  subscribe<TPayload>(
    eventName: string,
    consumerId: string,
    handler: EventHandler<TPayload>,
  ): void {
    if (!eventName || !consumerId || typeof handler !== 'function') {
      throw new Error('Event name, stable consumer id and handler are required');
    }
    if (this.handlersByConsumer.has(consumerId)) {
      throw new Error(`Duplicate event consumer "${consumerId}"`);
    }
    const queueName = `${EVENT_QUEUE_PREFIX}${this.safeId(consumerId, 120)}`;
    const registered: RegisteredHandler = {
      eventName,
      consumerId,
      handler: handler as EventHandler,
      queueName,
    };
    this.handlersByConsumer.set(consumerId, registered);
    const list = this.handlersByEvent.get(eventName) ?? [];
    list.push(registered);
    this.handlersByEvent.set(eventName, list);
    this.ensureWorker(registered);
    this.ensureLegacyBridgeWorker();
    this.logger.log(`Handler "${consumerId}" registered for event "${eventName}"`);
  }

  /**
   * A compatibility bridge for jobs published by a pre-dedicated-queue pod.
   * It deliberately has no registration-index fallback: an event for which
   * this binary has no consumer fails its BullMQ job and remains retryable for
   * the later pod that introduces that consumer.
   */
  private ensureLegacyBridgeWorker(): void {
    if (this.legacyWorker) return;
    this.legacyWorker = this.bullmq.createWorker(LEGACY_EVENT_QUEUE, async (job: Job) => {
      const legacy = job.data as DomainEventEnvelope | ConsumerJobData & { consumerId?: string };
      const eventName = 'eventName' in legacy ? legacy.eventName : job.name;
      const event = 'event' in legacy ? legacy.event : legacy;
      const targetedConsumer = 'consumerId' in legacy ? legacy.consumerId : undefined;
      const consumers = targetedConsumer
        ? [this.handlersByConsumer.get(targetedConsumer)].filter(
          (consumer): consumer is RegisteredHandler => Boolean(consumer && consumer.eventName === eventName),
        )
        : this.handlersByEvent.get(eventName) ?? [];
      if (consumers.length === 0) throw new NoEventConsumersRegisteredError(eventName);
      for (const consumer of consumers) await this.dispatch(consumer, event);
    });
  }

  private getQueue(queueName: string): Queue {
    return this.bullmq.getQueue(queueName);
  }

  private ensureWorker(registered: RegisteredHandler): void {
    if (this.workers.has(registered.consumerId)) return;
    const worker = this.bullmq.createWorker(registered.queueName, async (job: Job) => {
      const data = job.data as ConsumerJobData;
      if (data.eventName !== registered.eventName || job.name !== registered.eventName) {
        throw new Error(
          `Consumer "${registered.consumerId}" cannot handle event "${data.eventName}"`,
        );
      }
      await this.dispatch(registered, data.event);
    });
    this.workers.set(registered.consumerId, worker);
  }

  private async dispatch(
    registered: RegisteredHandler,
    event: DomainEventEnvelope,
  ): Promise<void> {
    const organizationId = (event.payload as Record<string, unknown>)?.organizationId as string | undefined;
    await this.cls.run(async () => {
      if (organizationId) {
        this.cls.set(TENANT_CLS_KEY, {
          organizationId,
          id: '',
          role: '',
          isSuperAdmin: false,
        });
      } else {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      }
      // Throwing is intentional: BullMQ owns retry/backoff and must never
      // acknowledge a transient consumer failure.
      await registered.handler(event);
    });
  }

  private safeId(value: string, maxLength: number): string {
    const safe = value.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, maxLength);
    if (!safe) throw new Error('Event/consumer identity has no queue-safe characters');
    return safe;
  }
}
