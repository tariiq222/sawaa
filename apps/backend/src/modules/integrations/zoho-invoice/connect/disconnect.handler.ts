import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant';
import { ZohoOAuthService } from '../../../../infrastructure/zoho';
import { ZohoConfigService } from '../zoho-config.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

@Injectable()
export class DisconnectHandler {
  private readonly logger = new Logger(DisconnectHandler.name);

  constructor(
    private readonly oauth: ZohoOAuthService,
    private readonly config: ZohoConfigService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<{ disconnected: true }> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const existing = await this.config.load(organizationId);
    if (existing.config?.refreshToken) {
      // Best-effort revoke — Zoho returns 200 either way.
      await this.oauth.revokeRefreshToken({
        refreshToken: existing.config.refreshToken,
        dataCenter: existing.config.dataCenter,
      });
    }
    await this.config.remove(organizationId);
    this.oauth.invalidateToken(organizationId);
    return { disconnected: true };
  }
}
