import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant';
import { ZohoApiClient } from '../../../../infrastructure/zoho';
import { ZohoConfigService } from '../zoho-config.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

/**
 * Validates the stored Zoho credentials by hitting `/organizations`. Fast,
 * cheap, idempotent — gives the tenant immediate feedback whether their
 * connection is alive.
 */
@Injectable()
export class TestZohoConfigHandler {
  private readonly logger = new Logger(TestZohoConfigHandler.name);

  constructor(
    private readonly api: ZohoApiClient,
    private readonly config: ZohoConfigService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<{ ok: boolean; error?: string; organizationName?: string }> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    try {
      const cfg = await this.config.require(organizationId);
      const orgs = await this.api.listOrganizations({
        organizationId,
        refreshToken: cfg.refreshToken,
        dataCenter: cfg.dataCenter,
      });
      const match = orgs.organizations.find(
        (o) => o.organization_id === cfg.zohoOrganizationId,
      );
      return {
        ok: Boolean(match),
        organizationName: match?.name,
        error: match ? undefined : 'Selected Zoho organization is no longer accessible.',
      };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`Zoho test failed for org ${organizationId}: ${message}`);
      return { ok: false, error: message };
    }
  }
}
