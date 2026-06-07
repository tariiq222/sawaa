const ORIGINAL_ENV = process.env;

describe('mobile config', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('prefers EXPO_PUBLIC_ORGANIZATION_ID for the default organization', async () => {
    process.env.EXPO_PUBLIC_ORGANIZATION_ID = 'org-new';
    process.env.EXPO_PUBLIC_TENANT_ID = 'tenant-old';

    const { DEFAULT_ORGANIZATION_ID, TENANT_ID } = await import('./config');

    expect(DEFAULT_ORGANIZATION_ID).toBe('org-new');
    expect(TENANT_ID).toBe('org-new');
  });

  it('keeps EXPO_PUBLIC_TENANT_ID as a deprecated fallback', async () => {
    delete process.env.EXPO_PUBLIC_ORGANIZATION_ID;
    process.env.EXPO_PUBLIC_TENANT_ID = 'tenant-old';

    const { DEFAULT_ORGANIZATION_ID } = await import('./config');

    expect(DEFAULT_ORGANIZATION_ID).toBe('tenant-old');
  });
});
