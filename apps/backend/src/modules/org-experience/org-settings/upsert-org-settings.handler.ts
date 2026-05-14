import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';

@Injectable()
export class UpsertOrgSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpsertOrgSettingsDto) {
    if (dto.vatRate !== undefined) {
      if (!this.tenant.isSuperAdmin()) {
        throw new ForbiddenException('Only super-admin can edit VAT rate');
      }
    }

    const existing = await this.prisma.organizationSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.prisma.organizationSettings.update({
        where: { id: existing.id },
        data: dto,
      });
    }
    return this.prisma.organizationSettings.create({ data: dto });
  }
}
