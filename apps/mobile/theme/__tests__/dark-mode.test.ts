import { buildTheme } from '../tokens';
import { sawaaColors } from '../sawaa/tokens';

describe('buildTheme dark mode', () => {
  it('produces different textPrimary in dark vs light', () => {
    const light = buildTheme(null, 'light');
    const dark = buildTheme(null, 'dark');
    expect(dark.colors.textPrimary).not.toBe(light.colors.textPrimary);
  });

  it('applies dark surface override (#0c2424) when surface key exists in light colors', () => {
    const light = buildTheme(null, 'light');
    const dark = buildTheme(null, 'dark');
    // surface exists in light palette — verify the key is present before asserting
    expect(light.colors.surface).toBeDefined();
    expect(dark.colors.surface).toBe('#0c2424');
  });

  it('applies dark background override', () => {
    const dark = buildTheme(null, 'dark');
    expect(dark.colors.background).toBe('#0a1f1e');
  });

  it('applies dark textSecondary override', () => {
    const dark = buildTheme(null, 'dark');
    expect(dark.colors.textSecondary).toBe('#9fbcba');
  });

  it('applies dark border override', () => {
    const dark = buildTheme(null, 'dark');
    expect(dark.colors.border).toBe('rgba(255,255,255,0.14)');
  });

  it('keeps light values when scheme is light', () => {
    const light = buildTheme(null, 'light');
    // #191C1E was the shared pre-Sawa token; light mode now maps the ink roles
    // onto the fixed palette exactly like dark mode does.
    expect(light.colors.textPrimary).toBe(sawaaColors.ink[900]);
    expect(light.colors.surface).toBe('#F7F9FB');
  });

  it('buildTheme() with no args still works (backward compat)', () => {
    const t = buildTheme();
    expect(t.colors.primary).toBe('#55CCB0');
  });
});
