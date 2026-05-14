import { Injectable } from '@nestjs/common';
import type { PublicBranding } from '@deqah/shared';
import { PrismaService } from '../../../../infrastructure/database';
import { TenantContextService } from '../../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

@Injectable()
export class GetPublicBrandingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<PublicBranding> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const row = await this.prisma.brandingConfig.findUnique({
      where: { organizationId },
    });

    if (!row) {
      return {
        organizationNameAr: 'منظمتي',
        organizationNameEn: null,
        productTagline: null,
        logoUrl: null,
        faviconUrl: null,
        colorPrimary: null,
        colorPrimaryLight: null,
        colorPrimaryDark: null,
        colorAccent: null,
        colorAccentDark: null,
        colorBackground: null,
        fontFamily: null,
        fontUrl: null,
        websiteDomain: null,
        activeWebsiteTheme: 'SAWAA',
      };
    }

    return {
      organizationNameAr: row.organizationNameAr,
      organizationNameEn: row.organizationNameEn,
      productTagline: row.productTagline,
      logoUrl: row.logoUrl,
      faviconUrl: row.faviconUrl,
      colorPrimary: row.colorPrimary,
      colorPrimaryLight: row.colorPrimaryLight,
      colorPrimaryDark: row.colorPrimaryDark,
      colorAccent: row.colorAccent,
      colorAccentDark: row.colorAccentDark,
      colorBackground: row.colorBackground,
      fontFamily: row.fontFamily,
      fontUrl: row.fontUrl,
      websiteDomain: row.websiteDomain,
      activeWebsiteTheme: row.activeWebsiteTheme,
    };
  }
}
