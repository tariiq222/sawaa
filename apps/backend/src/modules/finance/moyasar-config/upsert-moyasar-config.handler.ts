import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export interface UpsertMoyasarConfigCommand {
  publishableKey: string;
  secretKey?: string;
  webhookSecret?: string;
  isLive?: boolean;
}

export interface UpsertMoyasarConfigResult {
  organizationId: string;
  publishableKey: string;
  isLive: boolean;
  updatedAt: Date;
}

@Injectable()
export class UpsertMoyasarConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creds: MoyasarCredentialsService,
    private readonly moyasarClient: MoyasarApiClient,
  ) {}

  async execute(cmd: UpsertMoyasarConfigCommand): Promise<UpsertMoyasarConfigResult> {
    const organizationId = DEFAULT_ORG_ID;

    const existing = await this.prisma.organizationPaymentConfig.findFirst();

    // If updating an existing record and a secret is omitted, keep the existing encrypted value.
    let secretKeyEnc = existing?.secretKeyEnc ?? null;
    let webhookSecretEnc = existing?.webhookSecretEnc ?? null;

    if (cmd.secretKey !== undefined) {
      secretKeyEnc = this.creds.encrypt({ secretKey: cmd.secretKey }, organizationId);
    }
    if (cmd.webhookSecret !== undefined) {
      webhookSecretEnc = this.creds.encrypt(
        { webhookSecret: cmd.webhookSecret },
        organizationId,
      );
    }

    let row;
    if (existing) {
      row = await this.prisma.organizationPaymentConfig.update({
        where: { id: existing.id },
        data: {
          publishableKey: cmd.publishableKey,
          ...(secretKeyEnc !== null && { secretKeyEnc }),
          ...(webhookSecretEnc !== null && { webhookSecretEnc }),
          isLive: cmd.isLive ?? existing.isLive,
          // updating credentials invalidates the prior verification
          lastVerifiedAt: null,
          lastVerifiedStatus: null,
        },
      });
    } else {
      if (!cmd.secretKey || !cmd.webhookSecret) {
        throw new Error('secretKey and webhookSecret are required when creating a new Moyasar config');
      }
      row = await this.prisma.organizationPaymentConfig.create({
        data: {
          publishableKey: cmd.publishableKey,
          secretKeyEnc: secretKeyEnc!,
          webhookSecretEnc: webhookSecretEnc!,
          isLive: cmd.isLive ?? false,
        },
      });
    }

    // Invalidate the in-process key cache so the next payment request
    // picks up the newly written credentials instead of the stale copy.
    this.moyasarClient.invalidate(organizationId);

    return {
      organizationId: DEFAULT_ORG_ID,
      publishableKey: row.publishableKey,
      isLive: row.isLive,
      updatedAt: row.updatedAt,
    };
  }
}
