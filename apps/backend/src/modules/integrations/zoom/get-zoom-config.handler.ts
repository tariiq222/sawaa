import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class GetZoomConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const integration = await this.prisma.integration.findFirst({
      where: { provider: 'zoom' },
    });

    if (!integration) {
      return { configured: false, isActive: false };
    }

    return {
      configured: true,
      isActive: integration.isActive,
    };
  }
}
