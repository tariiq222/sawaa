import { buildTheme } from '../tokens';

describe('buildTheme', () => {
  it('falls back to Deqah platform defaults when no branding is loaded', () => {
    const t = buildTheme();
    expect(t.colors.primary).toBe('#354FD8');
    expect(t.colors.accent).toBe('#82CC17');
    expect(t.colors.background).toBe('#F7F9FB');
  });

  it('overrides primary/accent/background from valid branding', () => {
    const t = buildTheme({
      organizationNameAr: 'م',
      organizationNameEn: null,
      productTagline: null,
      logoUrl: null,
      faviconUrl: null,
      colorPrimary: '#aabbcc',
      colorPrimaryLight: null,
      colorPrimaryDark: null,
      colorAccent: '#112233',
      colorAccentDark: null,
      colorBackground: '#fafafa',
      fontFamily: null,
      fontUrl: null,
      websiteDomain: null,
      activeWebsiteTheme: 'SAWAA',
    });
    expect(t.colors.primary).toBe('#aabbcc');
    expect(t.colors.accent).toBe('#112233');
    expect(t.colors.background).toBe('#fafafa');
  });

  it('ignores invalid color strings and keeps defaults', () => {
    const fallback = buildTheme();
    const t = buildTheme({
      organizationNameAr: 'م',
      organizationNameEn: null,
      productTagline: null,
      logoUrl: null,
      faviconUrl: null,
      colorPrimary: 'not-a-color',
      colorPrimaryLight: null,
      colorPrimaryDark: null,
      colorAccent: '',
      colorAccentDark: null,
      colorBackground: null,
      fontFamily: null,
      fontUrl: null,
      websiteDomain: null,
      activeWebsiteTheme: 'SAWAA',
    });
    expect(t.colors.primary).toBe(fallback.colors.primary);
    expect(t.colors.accent).toBe(fallback.colors.accent);
    expect(t.colors.background).toBe(fallback.colors.background);
  });
});
