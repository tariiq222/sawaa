import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant';
import { ZohoOAuthService } from '../../../../infrastructure/zoho';
import { StartConnectDto, StartConnectResponseDto } from '../dto/connect.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

/**
 * Builds the Zoho OAuth consent URL and returns it to the dashboard so the
 * user can be redirected. State is signed and short-lived (5 min), and binds
 * the tenant + selected DC; the callback uses it to resolve the tenant
 * without trusting any other request input.
 */
@Injectable()
export class StartConnectHandler {
  constructor(
    private readonly oauth: ZohoOAuthService,
    private readonly tenant: TenantContextService,
  ) {}

  execute(dto: StartConnectDto): StartConnectResponseDto {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const { authUrl } = this.oauth.buildAuthorizationUrl({
      organizationId,
      dataCenter: dto.dc,
    });
    return { authUrl };
  }
}
