import { Injectable } from '@nestjs/common';
import { type PublicBranding, PLATFORM_BRAND } from '@sawaa/shared';
import { PrismaService } from '../../../../infrastructure/database';

/**
 * Public branding endpoint. Colors, font, logo and favicon are now fixed in the
 * apps — this only surfaces the editable identity (org name + tagline) and the
 * display time format, both sourced from OrganizationSettings. The color/font
 * fields are returned as the fixed platform values so any remaining consumer
 * stays in sync; new code should read the static tokens directly.
 */
@Injectable()
export class GetPublicBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PublicBranding> {
    const settings = await this.prisma.organizationSettings.findFirst({
      select: {
        companyNameAr: true,
        companyNameEn: true,
        productTagline: true,
        timeFormat: true,
      },
    });

    const timeFormat = (settings?.timeFormat === '24h' ? '24h' : '12h') as '12h' | '24h';

    return {
      organizationNameAr: settings?.companyNameAr?.trim() || PLATFORM_BRAND.nameAr,
      organizationNameEn: settings?.companyNameEn?.trim() || PLATFORM_BRAND.nameEn,
      productTagline: settings?.productTagline?.trim() || PLATFORM_BRAND.taglineAr,
      logoUrl: null,
      faviconUrl: null,
      colorPrimary: PLATFORM_BRAND.colors.primary,
      colorPrimaryLight: PLATFORM_BRAND.colors.primaryLight,
      colorPrimaryDark: PLATFORM_BRAND.colors.primaryDark,
      colorAccent: PLATFORM_BRAND.colors.accent,
      colorAccentDark: PLATFORM_BRAND.colors.accentDark,
      colorBackground: PLATFORM_BRAND.colors.background,
      fontFamily: 'Handicrafts',
      fontUrl: null,
      timeFormat,
    };
  }
}
