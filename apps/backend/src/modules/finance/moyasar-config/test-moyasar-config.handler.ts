import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';

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
    private readonly creds: MoyasarCredentialsService,
  ) {}

  async execute(): Promise<TestMoyasarConfigResult> {
    const cfg = await this.prisma.organizationPaymentConfig.findFirst();
    if (!cfg) {
      throw new BadRequestException('Moyasar is not configured for this organization');
    }
    const { secretKey } = this.creds.decrypt<{ secretKey: string }>(
      cfg.secretKeyEnc,
      DEFAULT_ORG_ID,
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
        `Moyasar connectivity test failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      status = 'NETWORK_ERROR';
    }

    if (cfg) {
      await this.prisma.organizationPaymentConfig.update({
        where: { id: cfg.id },
        data: { lastVerifiedAt: new Date(), lastVerifiedStatus: status },
      });
    }

    return { ok, status };
  }
}
