import { Injectable } from '@nestjs/common';
import {
  HealthCheckService,
  PrismaHealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import packageJson from '../../../../package.json';

export interface BuildMetadata {
  version: string;
  gitSha: string;
}

export const getBuildMetadata = (): BuildMetadata => ({
  version: process.env.APP_VERSION?.trim() || packageJson.version || 'unknown',
  gitSha: process.env.GIT_SHA?.trim() || 'unknown',
});

export interface HealthCheckResult {
  status: 'ok' | 'error';
  version: string;
  gitSha: string;
  info: Record<string, { status: string; [key: string]: unknown }>;
  error: Record<string, { status: string; message?: string }>;
  details: Record<string, { status: string; [key: string]: unknown }>;
}

@Injectable()
export class HealthCheckHandler {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly bullMq: BullMqService,
    private readonly minio: MinioService,
  ) {}

  async execute(): Promise<HealthCheckResult> {
    const result = await this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.checkRedis(),
      () => this.checkBullMq(),
      () => this.checkMinio(),
    ]);

    return { ...result, ...getBuildMetadata() } as unknown as HealthCheckResult;
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const client = this.redis.getClient();
      await client.ping();
      return { redis: { status: 'up' } };
    } catch (err) {
      return { redis: { status: 'down', message: err instanceof Error ? err.message : 'ping failed' } };
    }
  }

  private async checkBullMq(): Promise<HealthIndicatorResult> {
    try {
      const queue = this.bullMq.getQueue('ops-cron');
      const counts = await queue.getJobCounts();
      return { bullmq: { status: 'up', ...counts } };
    } catch (err) {
      return { bullmq: { status: 'down', message: err instanceof Error ? err.message : 'queue error' } };
    }
  }

  private async checkMinio(): Promise<HealthIndicatorResult> {
    try {
      await this.minio.ping();
      return { minio: { status: 'up' } };
    } catch (err) {
      return { minio: { status: 'down', message: err instanceof Error ? err.message : 'listBuckets failed' } };
    }
  }
}
