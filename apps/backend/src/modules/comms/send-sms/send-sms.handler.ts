// SaaS-02g-sms — dispatch SMS via the current tenant's configured provider
// and write a SmsDelivery audit row (one per send, success or failure).

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../infrastructure/database';
import { SmsProviderFactory } from '../../../infrastructure/sms/sms-provider.factory';
import { SmsProviderNotConfiguredError } from '../../../infrastructure/sms/sms-provider.interface';
import { SendSmsDto } from './send-sms.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type SendSmsCommand = SendSmsDto;

@Injectable()
export class SendSmsHandler {
  private readonly logger = new Logger(SendSmsHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: SmsProviderFactory,
  ) {}

  async execute(cmd: SendSmsCommand): Promise<void> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const adapter = await this.factory.forCurrentTenant(organizationId);
    const bodyHash = createHash('sha256').update(cmd.body).digest('hex');

    // When provider is NONE, skip + log (no audit row to avoid polluting history).
    if (adapter.name === 'NONE') {
      this.logger.warn(
        `SMS skipped — no provider configured for org ${organizationId} → ${cmd.phone}`,
      );
      return;
    }

    try {
      const result = await adapter.send(cmd.phone, cmd.body, null);
      await this.prisma.smsDelivery.create({
        data: {
          provider: adapter.name,
          toPhone: cmd.phone,
          body: cmd.body,
          bodyHash,
          status: result.status === 'SENT' ? 'SENT' : 'QUEUED',
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown SMS error';
      await this.prisma.smsDelivery.create({
        data: {
          provider: adapter.name,
          toPhone: cmd.phone,
          body: cmd.body,
          bodyHash,
          status: 'FAILED',
          errorMessage: message,
        },
      });
      if (err instanceof SmsProviderNotConfiguredError) {
        this.logger.warn(message);
        return;
      }
      throw err;
    }
  }
}
