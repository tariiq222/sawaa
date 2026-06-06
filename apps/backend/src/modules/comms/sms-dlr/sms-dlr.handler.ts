// Inbound provider DLR webhook handler.
//
// Three-stage flow:
//   1. System-context read of the deployment SMS config.
//   2. Verify HMAC signature (pure crypto, no DB).
//   3. Run mutation inside cls.run with the default org compatibility context.

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import {
  SYSTEM_CONTEXT_CLS_KEY,
  TENANT_CLS_KEY,
} from '../../../common/constants';
import { PrismaService } from '../../../infrastructure/database';
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

    // STAGE 2.5 — idempotency dedup. The dedup key is keyed on
    // `providerMessageId:status` (stable across retries of the same DLR, yet
    // distinct per status transition — so SENT → DELIVERED still processes).
    // Optimistic insert (create → catch P2002) makes the dedup atomic under
    // concurrent retries.
    const webhookEventId = `${parsed.providerMessageId}:${parsed.status}`;
    const payloadHash = createHash('sha256').update(req.rawBody).digest('hex');
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: `SMS_${req.provider}`,
          eventId: webhookEventId,
          eventType: parsed.status,
          payloadHash,
        },
        select: { id: true },
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

    // STAGE 3 — mutate inside the single-tenant compatibility CLS context.
    return this.cls.run(async () => {
      this.cls.set(TENANT_CLS_KEY, {
        organizationId: req.organizationId,
        id: 'system',
        role: 'system',
        isSuperAdmin: false,
      });
      await this.prisma.smsDelivery.updateMany({
        where: { providerMessageId: parsed.providerMessageId },
        data: {
          status: parsed.status,
          errorCode: parsed.errorCode,
          errorMessage: parsed.errorMessage,
          deliveredAt:
            parsed.status === 'DELIVERED' ? new Date() : undefined,
        },
      });
      return {};
    });
  }
}
