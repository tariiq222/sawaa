// Inbound provider DLR webhook handler.
//
// Three-stage flow:
//   1. System-context read of the deployment SMS config.
//   2. Verify HMAC signature (pure crypto, no DB).
//   3. Run mutation inside cls.run with the default org compatibility context.

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, SmsDeliveryStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import {
  SYSTEM_CONTEXT_CLS_KEY,
  TENANT_CLS_KEY,
} from '../../../common/constants';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';
import { SmsProviderFactory } from '../../../infrastructure/sms/sms-provider.factory';

export type SmsDlrRequest = {
  provider: 'UNIFONIC' | 'TAQNYAT';
  organizationId: string;
  rawBody: string;
  signature: string;
};

@Injectable()
export class SmsDlrHandler {
  private readonly logger = new Logger(SmsDlrHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: SmsProviderFactory,
    private readonly cls: ClsService,
    private readonly transaction: RlsTransactionService,
  ) {}

  async execute(req: SmsDlrRequest): Promise<{ skipped?: boolean }> {
    // STAGE 1 — resolve SMS config in system context.
    const cfg = await this.cls.run(async () => {
      this.logger.warn('systemContext bypass activated', { context: 'SmsDlrHandler' });
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.organizationSmsConfig.findFirst();
    });

    if (!cfg) {
      this.logger.warn('DLR received but no SMS config found');
      return { skipped: true };
    }
    if (cfg.provider !== req.provider) {
      this.logger.warn(
        `DLR provider mismatch: expected ${cfg.provider}, got ${req.provider}`,
      );
      return { skipped: true };
    }
    if (!cfg.webhookSecret) {
      throw new BadRequestException('No webhook secret on file');
    }

    // STAGE 2 — build adapter (in system ctx so credentials decrypt works)
    // and verify signature.
    const adapter = await this.cls.run(async () => {
      this.logger.warn('systemContext bypass activated', { context: 'SmsDlrHandler' });
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.factory.resolve();
    });
    if (adapter.name !== req.provider) {
      throw new BadRequestException('Provider mismatch');
    }
    const parsed = adapter.parseDlr(req.rawBody);
    adapter.verifyDlrSignature(
      {
        ...parsed,
        rawBody: req.rawBody,
        signature: req.signature,
      },
      cfg.webhookSecret,
    );

    // STAGE 3 — idempotency dedup and delivery mutation. The dedup key is keyed on
    // `providerMessageId:status` (stable across retries of the same DLR, yet
    // distinct per status transition — so SENT → DELIVERED still processes).
    // The claim and mutation share one transaction so a failed mutation rolls
    // the claim back and the provider can safely retry the webhook.
    const webhookEventId = `${parsed.providerMessageId}:${parsed.status}`;
    const payloadHash = createHash('sha256').update(req.rawBody).digest('hex');
    let stale = false;
    try {
      return await this.cls.run(async () => {
        this.cls.set(TENANT_CLS_KEY, {
          organizationId: req.organizationId,
          id: 'system',
          role: 'system',
          isSuperAdmin: false,
        });
        await this.transaction.withTransaction(async (tx) => {
          await tx.webhookEvent.create({
            data: {
              provider: `SMS_${req.provider}`,
              eventId: webhookEventId,
              eventType: parsed.status,
              payloadHash,
            },
            select: { id: true },
          });
          // Receipts can arrive out of order. Only move a delivery forward
          // (QUEUED → SENT/UNKNOWN → FAILED → DELIVERED); a late FAILED must
          // not overwrite a DELIVERED row.
          const applyReceipt = () =>
            tx.smsDelivery.updateMany({
              where: {
                providerMessageId: parsed.providerMessageId,
                status: { in: [...statusesBefore(parsed.status)] },
              },
              data: {
                status: parsed.status,
                errorCode: parsed.errorCode,
                errorMessage: parsed.errorMessage,
                deliveredAt:
                  parsed.status === 'DELIVERED' ? new Date() : undefined,
              },
            });
          let updated = await applyReceipt();
          if (updated.count === 0) {
            const current = await tx.smsDelivery.findFirst({
              where: { providerMessageId: parsed.providerMessageId },
              select: { status: true },
            });
            if (!current) {
              throw new Error(
                `SMS delivery not found for provider message ${parsed.providerMessageId}`,
              );
            }
            // The row may have been inserted by the sender right after the
            // first update ran; if it is still eligible, apply the receipt now
            // instead of committing the dedup claim as stale.
            if (statusesBefore(parsed.status).includes(current.status)) {
              updated = await applyReceipt();
            }
            if (updated.count === 0) stale = true;
          }
        });
        if (stale) {
          this.logger.log(
            `SMS DLR: skipped_stale provider=SMS_${req.provider} eventId=${webhookEventId}`,
          );
          return { skipped: true };
        }
        return {};
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(
          `SMS DLR: skipped_duplicate provider=SMS_${req.provider} eventId=${webhookEventId}`,
        );
        return { skipped: true };
      }
      throw err;
    }
  }
}

// A confirmed delivery is final: a late FAILED receipt must not overwrite it,
// while a DELIVERED receipt may still correct an earlier FAILED.
const DLR_STATUS_RANK: Record<SmsDeliveryStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  UNKNOWN: 1,
  FAILED: 2,
  DELIVERED: 3,
};

/** Current statuses a receipt with `next` may overwrite (strictly earlier ranks). */
function statusesBefore(next: SmsDeliveryStatus): SmsDeliveryStatus[] {
  const rank = DLR_STATUS_RANK[next];
  return (Object.keys(DLR_STATUS_RANK) as SmsDeliveryStatus[]).filter(
    (status) => DLR_STATUS_RANK[status] < rank,
  );
}
