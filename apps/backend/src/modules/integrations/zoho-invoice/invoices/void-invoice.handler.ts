import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { TenantContextService } from '../../../../common/tenant';
import { ZohoApiClient } from '../../../../infrastructure/zoho';
import { ZohoConfigService } from '../zoho-config.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

@Injectable()
export class VoidZohoInvoiceHandler {
  constructor(
    private readonly api: ZohoApiClient,
    private readonly config: ZohoConfigService,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(invoiceId: string): Promise<{ ok: true }> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const cfg = await this.config.require(organizationId);
    await this.api.voidInvoice(
      {
        organizationId,
        zohoOrganizationId: cfg.zohoOrganizationId,
        refreshToken: cfg.refreshToken,
        dataCenter: cfg.dataCenter,
      },
      invoiceId,
    );
    await this.prisma.zohoInvoiceLink.updateMany({
      where: { organizationId, zohoInvoiceId: invoiceId },
      data: { status: 'void' },
    });
    return { ok: true };
  }
}
