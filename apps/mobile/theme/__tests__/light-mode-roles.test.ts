import { colors as sharedColors } from '@sawaa/shared/tokens';
import { buildTheme } from '../tokens';
import { getSawaaColors, getSawaaRoles, sawaaTokens } from '../sawaa/tokens';

const light = buildTheme(null, 'light');
const dark = buildTheme(null, 'dark');
const palette = getSawaaColors('light');
const lightRoles = getSawaaRoles('light');
const darkRoles = getSawaaRoles('dark');

/** Attention/negative hues light keeps because the Sawa accents are tuned for
 *  dark surfaces; see the rationale in `theme/tokens.ts`. */
const lightInkExceptions = ['#F59E0B', '#F97316', '#DC2626', '#7C3AED', '#0EA5E9'];

/** The pre-Sawa brand mark that must never reach a rendered light surface. */
const preSawaaBrandValues = ['#354FD8', '#2438B0', '#82CC17', '#191C1E', '#64748B', '#C4C5D7', '#0D9488'];

function luminance(hex: string): number {
  const channels = hex.replace('#', '').slice(0, 6).match(/../g)!.map((pair) => parseInt(pair, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsOf);
  return [];
}

function leavesOf(value: unknown, path: string[] = []): Array<[string, unknown]> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leavesOf(child, [...path, key]));
  }
  return [[path.join('.'), value]];
}

const sawaaDerived = new Set<string>([
  ...stringsOf(palette),
  ...stringsOf(lightRoles),
  sawaaTokens.primary.light,
  '#FFFFFF',
  ...lightInkExceptions,
]);

describe('light appearance maps the shared roles onto the fixed Sawa palette', () => {
  it('re-points every inherited shared role instead of leaving the pre-Sawa palette behind', () => {
    const unmapped = leavesOf(sharedColors)
      // `primary`/`accent` are reshaped into single brand strings, not ramps.
      .filter(([path]) => !path.startsWith('primary.') && path !== 'accent.500')
      .flatMap(([path]) => {
        const resolved = path.split('.').reduce<unknown>(
          (node, key) => (node as Record<string, unknown> | undefined)?.[key],
          light.colors,
        );
        if (resolved === undefined) return [`${path} is missing`];
        return stringsOf(resolved).filter((value) => !sawaaDerived.has(value)).map((value) => `${path} = ${value}`);
      });

    expect(unmapped).toEqual([]);
    // The dark appearance is unchanged by the light-mode mapping.
    expect(darkRoles.surface).toBe('#0c2424');
  });

  it('no longer renders the pre-Sawa brand colours in light mode', () => {
    const rendered = stringsOf(light.colors);
    for (const oldBrand of preSawaaBrandValues) expect(rendered).not.toContain(oldBrand);

    // The two roles that actually showed the old brand mark on screen.
    expect(light.colors.status.completed).toBe(palette.teal[700]);
    expect(light.colors.secondary[500]).toBe(palette.teal[500]);
    expect(light.colors.teal).toBe(palette.teal[700]);
  });

  it('keeps light-mode text readable on the light surfaces', () => {
    for (const surface of [lightRoles.surface, lightRoles.surfaceLow, lightRoles.background]) {
      expect(contrast(light.colors.textPrimary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light.colors.textSecondary, surface)).toBeGreaterThanOrEqual(4.5);
    }
    // Muted copy is anchored to the card surface (4.51:1); on the canvas behind
    // the cards it measures 4.36:1 — still 2.7× the inherited #C4C5D7 (1.6:1),
    // which was unreadable. A darker muted would collapse the hierarchy with
    // textSecondary (ink[700]).
    expect(contrast(light.colors.textMuted, lightRoles.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.colors.textMuted, lightRoles.background)).toBeGreaterThanOrEqual(4.3);
    expect(light.colors.textMuted).toBe(palette.ink[500]);
    expect(contrast('#C4C5D7', lightRoles.surface)).toBeLessThan(2);
  });

  it('never lowers a light status hue below the contrast it shipped with', () => {
    // Ratios measured against `roles.surface` before the role mapping existed.
    const shipped: Array<[string, number]> = [
      [light.colors.status.pending, 2.03],
      [light.colors.status.confirmed, 3.57],
      [light.colors.status.completed, 6.1],
      [light.colors.status.cancelled, 4.58],
      [light.colors.status.pendingCancellation, 2.66],
      [light.colors.payment.paid, 3.57],
      [light.colors.payment.refunded, 5.4],
      [light.colors.payment.failed, 4.58],
    ];
    for (const [value, before] of shipped) {
      expect(contrast(value, lightRoles.surface)).toBeGreaterThanOrEqual(before - 0.05);
    }
    // The kept hues are the documented exceptions, not accidental leftovers.
    expect(lightInkExceptions).toContain(light.colors.status.cancelled);
    expect(lightInkExceptions).toContain(light.colors.payment.refunded);
  });

  it('keeps a visible light hairline border and pure white as a light surface', () => {
    expect(light.colors.border).toBe(lightRoles.surfaceHigh);
    expect(light.colors.border).not.toBe(lightRoles.surface);
    expect(light.colors.border).not.toBe(palette.glass.border);
    expect(light.colors.white).toBe('#FFFFFF');
    // Dark still remaps the surface roles and the pure-white card.
    expect(dark.colors.white).toBe(darkRoles.surface);
    for (const key of ['white', 'surface', 'surfaceLow', 'surfaceHigh'] as const) {
      expect(luminance(dark.colors[key])).toBeLessThan(0.06);
    }
  });

  it('keeps every dark status role on the Sawa accent ramp', () => {
    const darkPalette = getSawaaColors('dark');
    expect(dark.colors.status.completed).toBe(darkPalette.accent.sky);
    expect(dark.colors.status.confirmed).toBe(darkPalette.teal[600]);
    expect(dark.colors.payment.paid).toBe(darkPalette.teal[600]);
    expect(dark.colors.error).toBe(darkPalette.accent.coral);
    expect(dark.colors.warning).toBe(darkPalette.accent.amber);
  });
});
