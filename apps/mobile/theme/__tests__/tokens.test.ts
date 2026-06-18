import { buildTheme } from '../tokens';

describe('buildTheme', () => {
  it('uses the fixed teal + beige palette when no branding is loaded', () => {
    const t = buildTheme();
    expect(t.colors.primary).toBe('#55CCB0');
    expect(t.colors.accent).toBe('#E7DBC4');
    expect(t.colors.background).toBe('#EAF8F4');
  });

  it('ignores branding colors and keeps the fixed palette', () => {
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
      timeFormat: '24h',
      contactPhone: null,
      contactEmail: null,
    });
    expect(t.colors.primary).toBe('#55CCB0');
    expect(t.colors.accent).toBe('#E7DBC4');
    expect(t.colors.background).toBe('#EAF8F4');
  });
});
