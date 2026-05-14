import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class UpsertOrgSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpsertOrgSettingsDto) {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    if (dto.vatRate !== undefined) {
      if (!this.tenant.isSuperAdmin()) {
        throw new ForbiddenException('Only super-admin can edit VAT rate');
      }
    }

    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      update: dto,
      create: { ...dto },
    });
  }
}
