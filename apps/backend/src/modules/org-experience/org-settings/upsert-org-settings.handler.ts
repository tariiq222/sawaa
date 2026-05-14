import { Injectable, ForbiddenException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { TENANT_CLS_KEY } from '../../../common/constants';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';

@Injectable()
export class UpsertOrgSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async execute(dto: UpsertOrgSettingsDto) {
    if (dto.vatRate !== undefined) {
      const tenantCtx = this.cls.get<{ isSuperAdmin?: boolean }>(TENANT_CLS_KEY);
      if (!tenantCtx?.isSuperAdmin) {
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
