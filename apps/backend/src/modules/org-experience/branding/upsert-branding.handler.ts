import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpsertBrandingDto } from './upsert-branding.dto';
import {
  getAllowedAssetHosts,
  getAllowedFontHosts,
  sanitizeCustomCss,
  validateAssetUrl,
} from './branding-sanitizers';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class UpsertBrandingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpsertBrandingDto) {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const assetHosts = getAllowedAssetHosts();
    const fontHosts = getAllowedFontHosts();

    if (dto.logoUrl) {
      const r = validateAssetUrl(dto.logoUrl, assetHosts);
      if (!r.ok) throw new BadRequestException(`logoUrl: ${r.reason}`);
    }
    if (dto.faviconUrl) {
      const r = validateAssetUrl(dto.faviconUrl, assetHosts);
      if (!r.ok) throw new BadRequestException(`faviconUrl: ${r.reason}`);
    }
    if (dto.fontUrl) {
      const r = validateAssetUrl(dto.fontUrl, fontHosts);
      if (!r.ok) throw new BadRequestException(`fontUrl: ${r.reason}`);
    }
    if (dto.customCss) {
      const r = sanitizeCustomCss(dto.customCss, assetHosts);
      if (!r.ok) throw new BadRequestException(`customCss: ${r.reason}`);
    }

    return this.prisma.brandingConfig.upsert({
      where: { organizationId },
      create: { ...dto, organizationNameAr: dto.organizationNameAr ?? 'منظمتي' },
      update: dto,
    });
  }
}
