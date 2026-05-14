import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface GetMoyasarConfigResult {
  publishableKey: string;
  secretKeyMasked: string;
  hasWebhookSecret: boolean;
  isLive: boolean;
  lastVerifiedAt: Date | null;
  lastVerifiedStatus: string | null;
  updatedAt: Date;
}

@Injectable()
export class GetMoyasarConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<GetMoyasarConfigResult | null> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const cfg = await this.prisma.organizationPaymentConfig.findUnique({
      where: { organizationId },
    });
    if (!cfg) return null;

    // Mask: never return the encrypted secret over the wire. The publishable
    // key already encodes test/live, so reuse its prefix and reveal only the
    // last 4 chars of its tail so a clinic admin can confirm which key is live.
    const liveOrTest = cfg.publishableKey.startsWith('pk_live_') ? 'live' : 'test';
    const tail = cfg.publishableKey.slice(-4);
    return {
      publishableKey: cfg.publishableKey,
      secretKeyMasked: `sk_${liveOrTest}_•••••••${tail}`,
      hasWebhookSecret: cfg.webhookSecretEnc !== null,
      isLive: cfg.isLive,
      lastVerifiedAt: cfg.lastVerifiedAt,
      lastVerifiedStatus: cfg.lastVerifiedStatus,
      updatedAt: cfg.updatedAt,
    };
  }
}
