import { ListSiteSettingsHandler } from './list-site-settings.handler';

const row = (key: string) => ({
  key,
  valueText: null,
  valueAr: `ar-${key}`,
  valueEn: `en-${key}`,
  valueJson: null,
  valueMedia: null,
  updatedAt: new Date(),
});

describe('ListSiteSettingsHandler', () => {
  it('returns all settings when no prefix supplied', async () => {
    const prisma = {
      siteSetting: {
        findMany: jest.fn().mockResolvedValue([
          row('home.hero.title.ar'),
          row('home.stats.0.value'),
        ]),
      },
    };
    const handler = new ListSiteSettingsHandler(prisma as never);
    const result = await handler.execute();
    expect(prisma.siteSetting.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { key: 'asc' },
    });
    expect(result).toHaveLength(2);
    expect(result[0]!.key).toBe('home.hero.title.ar');
  });

  it('filters by prefix when supplied', async () => {
    const prisma = {
      siteSetting: {
        findMany: jest.fn().mockResolvedValue([row('home.hero.title.ar')]),
      },
    };
    const handler = new ListSiteSettingsHandler(prisma as never);
    await handler.execute({ prefix: 'home.hero.' });
    expect(prisma.siteSetting.findMany).toHaveBeenCalledWith({
      where: { key: { startsWith: 'home.hero.' } },
      orderBy: { key: 'asc' },
    });
  });

  it('strips Prisma-internal fields from rows', async () => {
    const prisma = {
      siteSetting: {
        findMany: jest.fn().mockResolvedValue([row('home.hero.title.ar')]),
      },
    };
    const handler = new ListSiteSettingsHandler(prisma as never);
    const result = await handler.execute();
    expect(result[0]).not.toHaveProperty('updatedAt');
    expect(result[0]).toEqual({
      key: 'home.hero.title.ar',
      valueText: null,
      valueAr: 'ar-home.hero.title.ar',
      valueEn: 'en-home.hero.title.ar',
      valueJson: null,
      valueMedia: null,
    });
  });
});
