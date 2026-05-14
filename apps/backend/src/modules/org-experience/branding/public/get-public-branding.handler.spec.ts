import { GetPublicBrandingHandler } from './get-public-branding.handler';
import { TenantContextService } from '../../../../common/tenant';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockRow = {
  id: 'some-uuid',
  organizationId: DEFAULT_ORG,
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
  activeWebsiteTheme: 'SAWAA' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = (row: typeof mockRow | null = mockRow) => ({
  brandingConfig: {
    findUnique: jest.fn().mockResolvedValue(row),
  },
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
  }) as unknown as TenantContextService;

describe('GetPublicBrandingHandler', () => {
  it('maps the Prisma row to PublicBranding shape', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicBrandingHandler(prisma as never, buildTenant());

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
      activeWebsiteTheme: 'SAWAA',
    });
    expect(result).not.toHaveProperty('customCss');
    expect(result).not.toHaveProperty('id');
  });

  it('reads via findUnique scoped by organizationId (no write)', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicBrandingHandler(prisma as never, buildTenant());

    await handler.execute();

    expect(prisma.brandingConfig.findUnique).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
    });
  });

  it('returns safe defaults when no row exists (does not create one)', async () => {
    const prisma = buildPrisma(null);
    const handler = new GetPublicBrandingHandler(prisma as never, buildTenant());

    const result = await handler.execute();

    expect(result.organizationNameAr).toBe('منظمتي');
    expect(result.activeWebsiteTheme).toBe('SAWAA');
    expect(result.colorPrimary).toBeNull();
    expect((prisma.brandingConfig as any).create).toBeUndefined();
  });
});
