import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant';
import { ZohoApiClient } from '../../../../infrastructure/zoho';
import { ZohoConfigService } from '../zoho-config.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

@Injectable()
export class GetZohoInvoiceHandler {
  constructor(
    private readonly api: ZohoApiClient,
    private readonly config: ZohoConfigService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(invoiceId: string) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const cfg = await this.config.require(organizationId);
    return this.api.getInvoice(
      {
        organizationId,
        zohoOrganizationId: cfg.zohoOrganizationId,
        refreshToken: cfg.refreshToken,
        dataCenter: cfg.dataCenter,
      },
      invoiceId,
    );
  }
}
