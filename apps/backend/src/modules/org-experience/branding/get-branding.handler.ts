import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class GetBrandingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const row = await this.prisma.brandingConfig.findUnique({
      where: { organizationId },
    });
    if (row) return row;
    return this.prisma.brandingConfig.create({
      data: { organizationNameAr: 'منظمتي' },
    });
  }
}
