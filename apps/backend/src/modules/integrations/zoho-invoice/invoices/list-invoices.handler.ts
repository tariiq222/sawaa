import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant';
import { ZohoApiClient } from '../../../../infrastructure/zoho';
import { ZohoConfigService } from '../zoho-config.service';
import { ListInvoicesQueryDto } from '../dto/connect.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

/**
 * Proxies a Zoho /invoices listing for the dashboard's Zoho tab. Returns
 * the raw Zoho list (we don't try to merge with the local Invoice table —
 * the dashboard's own listing is for that, this view is "what's on Zoho's
 * side for this tenant").
 */
@Injectable()
export class ListZohoInvoicesHandler {
  constructor(
    private readonly api: ZohoApiClient,
    private readonly config: ZohoConfigService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: ListInvoicesQueryDto) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const cfg = await this.config.require(organizationId);
    const result = await this.api.listInvoices(
      {
        organizationId,
        zohoOrganizationId: cfg.zohoOrganizationId,
        refreshToken: cfg.refreshToken,
        dataCenter: cfg.dataCenter,
      },
      {
        status: query.status,
        customer_id: query.customerId,
        page: query.page,
        per_page: query.perPage,
      },
    );
    return result;
  }
}
