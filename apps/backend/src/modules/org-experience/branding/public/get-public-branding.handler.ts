import { Injectable } from '@nestjs/common';
import type { PublicBranding } from '@sawaa/shared';
import { PrismaService } from '../../../../infrastructure/database';

@Injectable()
export class GetPublicBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PublicBranding> {
    const row = await this.prisma.brandingConfig.findFirst({
      orderBy: { createdAt: 'desc' },
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
    };
  }
}
