import { PLATFORM_BRAND } from '@sawaa/shared';
import { GetPublicBrandingHandler } from './get-public-branding.handler';

const buildPrisma = (
  settings: {
    companyNameAr?: string | null;
    companyNameEn?: string | null;
    productTagline?: string | null;
    timeFormat?: string;
    contactPhone?: string | null;
    contactEmail?: string | null;
  } | null = {
    companyNameAr: 'عيادتي',
    companyNameEn: 'My Clinic',
    productTagline: 'شعارنا',
    timeFormat: '12h',
    contactPhone: '0558446605',
    contactEmail: null,
  },
) => ({
  organizationSettings: {
    findFirst: jest.fn().mockResolvedValue(settings),
  },
});

describe('GetPublicBrandingHandler', () => {
  it('returns the editable identity from OrganizationSettings with fixed colors/font', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicBrandingHandler(prisma as never);

    const result = await handler.execute();

    expect(result).toEqual({
      organizationNameAr: 'عيادتي',
      organizationNameEn: 'My Clinic',
      productTagline: 'شعارنا',
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
      timeFormat: '12h',
      contactPhone: '0558446605',
      contactEmail: null,
    });
    expect(result).not.toHaveProperty('websiteDomain');
  });

  it('reads via findFirst (no write)', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicBrandingHandler(prisma as never);

    await handler.execute();

    expect(prisma.organizationSettings.findFirst).toHaveBeenCalled();
    expect((prisma.organizationSettings as never as { create?: unknown }).create).toBeUndefined();
  });

  it('falls back to platform defaults when settings are empty', async () => {
    const prisma = buildPrisma(null);
    const handler = new GetPublicBrandingHandler(prisma as never);

    const result = await handler.execute();

    expect(result.organizationNameAr).toBe(PLATFORM_BRAND.nameAr);
    expect(result.organizationNameEn).toBe(PLATFORM_BRAND.nameEn);
    expect(result.productTagline).toBe(PLATFORM_BRAND.taglineAr);
    expect(result.colorPrimary).toBe(PLATFORM_BRAND.colors.primary);
  });

  it('defaults timeFormat to 12h for invalid values', async () => {
    const prisma = buildPrisma({ companyNameAr: 'x', timeFormat: 'weird' });
    const handler = new GetPublicBrandingHandler(prisma as never);

    const result = await handler.execute();

    expect(result.timeFormat).toBe('12h');
  });

  it('returns contactPhone and contactEmail when set', async () => {
    const prisma = buildPrisma({
      companyNameAr: 'عيادتي',
      companyNameEn: 'My Clinic',
      productTagline: 'شعارنا',
      timeFormat: '12h',
      contactPhone: '0558446605',
      contactEmail: 'support@sawaa.sa',
    });
    const handler = new GetPublicBrandingHandler(prisma as never);
    const result = await handler.execute();
    expect(result.contactPhone).toBe('0558446605');
    expect(result.contactEmail).toBe('support@sawaa.sa');
  });

  it('returns null contactPhone and contactEmail when not set', async () => {
    const prisma = buildPrisma({ companyNameAr: 'x' });
    const handler = new GetPublicBrandingHandler(prisma as never);
    const result = await handler.execute();
    expect(result.contactPhone).toBeNull();
    expect(result.contactEmail).toBeNull();
  });
});
