import { GetPublicBrandingHandler } from './get-public-branding.handler';

const mockRow = {
  id: 'some-uuid',
  organizationNameAr: 'عيادتي',
  organizationNameEn: 'My Clinic',
  productTagline: null,
  logoUrl: null,
  faviconUrl: null,
  colorPrimary: '#354FD8',
  colorPrimaryLight: null,
  colorPrimaryDark: null,
  colorAccent: null,
  colorAccentDark: null,
  colorBackground: null,
  fontFamily: null,
  fontUrl: null,
  customCss: null,
  websiteDomain: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = (row: typeof mockRow | null = mockRow, timeFormat = '12h') => ({
  brandingConfig: {
    findFirst: jest.fn().mockResolvedValue(row),
  },
  organizationSettings: {
    findFirst: jest.fn().mockResolvedValue({ timeFormat }),
  },
});

describe('GetPublicBrandingHandler', () => {
  it('maps the Prisma row to PublicBranding shape', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicBrandingHandler(prisma as never);

    const result = await handler.execute();

    expect(result).toEqual({
      organizationNameAr: 'عيادتي',
      organizationNameEn: 'My Clinic',
      productTagline: null,
      logoUrl: null,
      faviconUrl: null,
      colorPrimary: '#354FD8',
      colorPrimaryLight: null,
      colorPrimaryDark: null,
      colorAccent: null,
      colorAccentDark: null,
      colorBackground: null,
      fontFamily: null,
      fontUrl: null,
      websiteDomain: null,
      timeFormat: '12h',
    });
    expect(result).not.toHaveProperty('customCss');
    expect(result).not.toHaveProperty('id');
  });

  it('reads via findFirst (no write)', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicBrandingHandler(prisma as never);

    await handler.execute();

    expect(prisma.brandingConfig.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns safe defaults when no row exists (does not create one)', async () => {
    const prisma = buildPrisma(null);
    const handler = new GetPublicBrandingHandler(prisma as never);

    const result = await handler.execute();

    expect(result.organizationNameAr).toBe('منظمتي');
    expect(result.colorPrimary).toBeNull();
    expect((prisma.brandingConfig as any).create).toBeUndefined();
  });
});
