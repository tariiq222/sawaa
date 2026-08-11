import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import {
  WHATSAPP_INBOUND_QUEUE,
  type WhatsappInboundJobData,
} from '../../../infrastructure/whatsapp/whatsapp-inbound-queue.service';
import { AgentOrchestratorService } from '../agent/agent-orchestrator.service';

const LOCK_TTL_MS = 120_000;
const RELEASE_OWNED_LOCK = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`;
const RENEW_OWNED_LOCK = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('pexpire', KEYS[1], ARGV[2])
  end
  return 0
`;

@Injectable()
export class WhatsappInboundWorker implements OnModuleInit {
  constructor(
    private readonly bullMq: BullMqService,
    private readonly redis: RedisService,
    private readonly orchestrator: AgentOrchestratorService,
  ) {}

  onModuleInit(): void {
    this.bullMq.createWorker<WhatsappInboundJobData>(
      WHATSAPP_INBOUND_QUEUE,
      (job) => this.execute(job.data),
      { concurrency: 10 },
    );
  }

  async execute(data: WhatsappInboundJobData): Promise<void> {
    const phoneHash = createHash('sha256').update(data.phone).digest('hex');
    const lockKey = `whatsapp:inbound:lock:${phoneHash}`;
    const lockToken = randomUUID();
    const client = this.redis.getClient();
    const acquired = await client.set(lockKey, lockToken, 'PX', LOCK_TTL_MS, 'NX');
    if (acquired !== 'OK') {
      throw new Error('Another WhatsApp message for this phone is already being processed');
    }

    const renewal = setInterval(() => {
      void client
        .eval(RENEW_OWNED_LOCK, 1, lockKey, lockToken, LOCK_TTL_MS)
        .catch(() => undefined);
    }, LOCK_TTL_MS / 3);
    renewal.unref();
    try {
      await this.orchestrator.handleInbound(
        data.phone,
        data.text,
        data.externalMessageId,
        data.contactName,
      );
    } finally {
      clearInterval(renewal);
      await client.eval(RELEASE_OWNED_LOCK, 1, lockKey, lockToken);
    }
  }
}
