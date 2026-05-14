import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';

/**
 * Shared Redis connection used by cache, token blacklist, and any BC that
 * needs direct key/value access.
 *
 * BullMQ requires its own connection with `maxRetriesPerRequest: null`
 * (see {@link BullMqService}) so we do NOT reuse this client for queues —
 * we only expose it via {@link getClient} for direct command usage.
 *
 * The connection is lazy: ioredis connects on first command, but we call
 * {@link Redis.connect} in `onModuleInit` so boot fails fast if Redis is
 * unreachable.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis(this.buildOptions());
  }

  async onModuleInit(): Promise<void> {
    // ioredis auto-connects lazily; force an eager PING so a misconfigured
    // Redis host crashes the app at boot instead of on first command.
    await this.client.ping();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  /**
   * Raw ioredis client. Use this for direct commands (GET/SET/DEL/EXPIRE).
   * BullMQ must not use this instance — see {@link BullMqService}.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Build RedisOptions from validated env. `lazyConnect: false` so the
   * client warms its socket during constructor; `enableReadyCheck: true`
   * ensures commands wait for a READY response before executing.
   */
  buildOptions(): RedisOptions {
    const password = this.config.get<string>('REDIS_PASSWORD');
    return {
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: this.config.getOrThrow<number>('REDIS_PORT'),
      db: this.config.get<number>('REDIS_DB') ?? 0,
      password: password && password.length > 0 ? password : undefined,
      lazyConnect: false,
      enableReadyCheck: true,
    };
  }
}
