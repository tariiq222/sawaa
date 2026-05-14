import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY, SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../../common/tenant/tenant.constants';
import { MoyasarSubscriptionClient } from './moyasar-subscription.client';


interface WebhookEventPayload {
  /** Moyasar's outer event id — unique per webhook delivery, used for dedup. */
  id?: string;
  type: string;
  data: {
    id: string;
    status: string;
    /** Payment amount in halalas (1 SAR = 100 halalas). */
    amount: number;
    /** ISO 4217 currency code, e.g. "SAR". */
    currency?: string;
    source?: { message?: string };
  };
}

const PROVIDER = 'MOYASAR_PLATFORM';

@Injectable()
export class MoyasarSubscriptionWebhookHandler {
  private readonly logger = new Logger(MoyasarSubscriptionWebhookHandler.name);

  constructor(
    private readonly client: MoyasarSubscriptionClient,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async execute(rawBody: Buffer, signature: string): Promise<{ ok: true; deduped?: true }> {
    const rawStr = rawBody.toString('utf8');

    // Stage 1: verify signature
    if (!this.client.verifyWebhookSignature(rawStr, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let event: WebhookEventPayload;
    try {
      event = JSON.parse(rawStr) as WebhookEventPayload;
    } catch {
      throw new BadRequestException('Malformed webhook payload');
    }

    if (!event.type || !event.data?.id) {
      throw new BadRequestException('Malformed webhook payload');
    }

    // Stage 2: idempotency guard.
    // Moyasar redelivers webhooks on receipt failure — without this dedup the
    // RecordSubscriptionPaymentHandler runs twice, double-emails, double-counts.
    // We use the outer event.id when present; fall back to data.id (payment id)
    // for older payloads that don't carry one.
    const eventId = event.id ?? event.data.id;
    const payloadHash = createHash('sha256').update(rawStr).digest('hex');

    let webhookEventRowId: string;
    try {
      const created = await this.prisma.webhookEvent.create({
        data: {
          provider: PROVIDER,
          eventId,
          eventType: event.type,
          payloadHash,
        },
        select: { id: true },
      });
      webhookEventRowId = created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(
          `Subscription webhook: skipped_duplicate provider=${PROVIDER} eventId=${eventId}`,
        );
        return { ok: true, deduped: true };
      }
      throw err;
    }

    try {
      const result = await this.process(event);
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventRowId },
        data: { processedAt: new Date(), result: 'processed' },
      });
      return result;
    } catch (err) {
      await this.prisma.webhookEvent
        .update({
          where: { id: webhookEventRowId },
          data: { processedAt: new Date(), result: 'error' },
        })
        .catch((updateErr) => {
          this.logger.error(
            `Failed to mark webhook event as error (${webhookEventRowId}): ${String(updateErr)}`,
          );
        });
      throw err;
    }
  }

  private async process(event: WebhookEventPayload): Promise<{ ok: true }> {
    // Subscription billing removed in single-tenant mode — acknowledge and skip
    this.logger.debug(`Subscription webhook: billing removed in single-tenant mode, event type ${event.type}`);
    return { ok: true };
  }
}
