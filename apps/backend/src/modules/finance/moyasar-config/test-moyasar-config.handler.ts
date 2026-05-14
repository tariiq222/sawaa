import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface TestMoyasarConfigResult {
  ok: boolean;
  status: 'OK' | 'INVALID_KEY' | 'NETWORK_ERROR' | string;
}

/**
 * Probes Moyasar with the tenant's stored secret key by hitting a low-impact
 * read endpoint (`GET /payments?per=1`). Persists the result so the dashboard
 * can show "last verified ✓ 2m ago" without re-probing on every page load.
 */
@Injectable()
export class TestMoyasarConfigHandler {
  private readonly logger = new Logger(TestMoyasarConfigHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly creds: MoyasarCredentialsService,
  ) {}

  async execute(): Promise<TestMoyasarConfigResult> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const cfg = await this.prisma.organizationPaymentConfig.findUnique({
      where: { organizationId },
    });
    if (!cfg) {
      throw new BadRequestException('Moyasar is not configured for this organization');
    }
    const { secretKey } = this.creds.decrypt<{ secretKey: string }>(
      cfg.secretKeyEnc,
      organizationId,
    );

    let status: TestMoyasarConfigResult['status'];
    let ok = false;
    try {
      const res = await fetch('https://api.moyasar.com/v1/payments?per=1', {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (res.status === 200) {
        status = 'OK';
        ok = true;
      } else if (res.status === 401 || res.status === 403) {
        status = 'INVALID_KEY';
      } else {
        status = `HTTP_${res.status}`;
      }
    } catch (err) {
      this.logger.warn(
        `Moyasar connectivity test failed for org ${organizationId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      status = 'NETWORK_ERROR';
    }

    await this.prisma.organizationPaymentConfig.update({
      where: { organizationId },
      data: { lastVerifiedAt: new Date(), lastVerifiedStatus: status },
    });

    return { ok, status };
  }
}
