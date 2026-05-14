import { Global, Module } from '@nestjs/common';
import { RedisService } from './cache/redis.service';
import { BullMqService } from './queue/bull-mq.service';
import { EventBusService } from './events/event-bus.service';

/**
 * Global messaging infrastructure module.
 *
 * Groups the three adapters required by every Bounded Context for
 * cross-cutting communication:
 *
 * - {@link RedisService}   — shared ioredis client for cache / blacklist
 * - {@link BullMqService}  — queue + worker factory
 * - {@link EventBusService} — inter-context domain event bus
 *
 * Marked `@Global()` so BCs can inject any of these without re-importing
 * the module — matches the pattern of {@link DatabaseModule}.
 */
@Global()
@Module({
  providers: [RedisService, BullMqService, EventBusService],
  exports: [RedisService, BullMqService, EventBusService],
})
export class MessagingModule {}
