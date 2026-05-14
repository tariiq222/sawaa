import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface UpsertMoyasarConfigCommand {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  isLive: boolean;
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
    private readonly tenant: TenantContextService,
    private readonly creds: MoyasarCredentialsService,
    private readonly moyasarClient: MoyasarApiClient,
  ) {}

  async execute(cmd: UpsertMoyasarConfigCommand): Promise<UpsertMoyasarConfigResult> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const secretKeyEnc = this.creds.encrypt({ secretKey: cmd.secretKey }, organizationId);
    const webhookSecretEnc = this.creds.encrypt(
      { webhookSecret: cmd.webhookSecret },
      organizationId,
    );

    const row = await this.prisma.organizationPaymentConfig.upsert({
      where: { organizationId },
      create: {
        publishableKey: cmd.publishableKey,
        secretKeyEnc,
        webhookSecretEnc,
        isLive: cmd.isLive,
      },
      update: {
        publishableKey: cmd.publishableKey,
        secretKeyEnc,
        webhookSecretEnc,
        isLive: cmd.isLive,
        // updating credentials invalidates the prior verification
        lastVerifiedAt: null,
        lastVerifiedStatus: null,
      },
    });

    // Invalidate the in-process key cache so the next payment request
    // picks up the newly written credentials instead of the stale copy.
    this.moyasarClient.invalidate(organizationId);

    return {
      organizationId: row.organizationId,
      publishableKey: row.publishableKey,
      isLive: row.isLive,
      updatedAt: row.updatedAt,
    };
  }
}
