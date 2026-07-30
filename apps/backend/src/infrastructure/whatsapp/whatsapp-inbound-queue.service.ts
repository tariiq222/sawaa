import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { BullMqService } from '../queue/bull-mq.service';
import { RedisService } from '../cache/redis.service';

export const WHATSAPP_INBOUND_QUEUE = 'whatsapp-inbound';
export const WHATSAPP_INBOUND_JOB = 'process-inbound-message';

export interface WhatsappInboundJobData {
  instance: string;
  phone: string;
  text: string;
  externalMessageId?: string;
}

export interface EnqueueWhatsappInboundInput extends WhatsappInboundJobData {
  rawBody: string;
}

@Injectable()
export class WhatsappInboundQueueService {
  constructor(
    private readonly bullMq: BullMqService,
    private readonly redis: RedisService,
  ) {}

  async enqueue(input: EnqueueWhatsappInboundInput): Promise<void> {
    const idempotencySource = input.externalMessageId
      ? `${input.instance}:${input.externalMessageId}`
      : input.rawBody;
    const jobId = createHash('sha256').update(idempotencySource).digest('hex');
    const client = this.redis.getClient();
    const seenKey = `whatsapp:inbound:seen:${jobId}`;
    const firstSeen = await client.set(
      seenKey,
      '1',
      'EX',
      300,
      'NX',
    );
    if (firstSeen !== 'OK') return;

    const phoneHash = createHash('sha256').update(input.phone).digest('hex');
    const rateKey = `whatsapp:inbound:rate:${phoneHash}`;
    const count = await client.incr(rateKey);
    if (count === 1) await client.expire(rateKey, 300);
    if (count > 30) return;
    const data: WhatsappInboundJobData = {
      instance: input.instance,
      phone: input.phone,
      text: input.text.slice(0, 4_000),
      externalMessageId: input.externalMessageId,
    };

    try {
      await this.bullMq.getQueue(WHATSAPP_INBOUND_QUEUE).add(
        WHATSAPP_INBOUND_JOB,
        data,
        { jobId },
      );
    } catch (error: unknown) {
      await client.del(seenKey);
      throw error;
    }
  }
}
