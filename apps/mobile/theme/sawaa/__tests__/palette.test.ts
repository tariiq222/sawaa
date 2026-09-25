import { getSawaaColors, getSawaaRoles, sawaaColors } from '../tokens';
import { buildTheme } from '../../tokens';

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/.{2}/g)!.slice(0, 3).map((v) => {
    const n = parseInt(v, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('scheme-aware Sawa palette', () => {
  it('preserves the original light palette and shape without mutating it', () => {
    const before = JSON.stringify(sawaaColors);
    const dark = getSawaaColors('dark');
    expect(getSawaaColors('light')).toBe(sawaaColors);
    for (const key of Object.keys(sawaaColors) as Array<keyof typeof sawaaColors>) {
      expect(Object.keys(dark[key])).toEqual(Object.keys(sawaaColors[key]));
    }
    expect(JSON.stringify(sawaaColors)).toBe(before);
  });

  it('keeps all text and accent roles readable on dark opaque and tinted surfaces', () => {
    const colors = getSawaaColors('dark');
    const surfaces = [colors.glass.opaqueBg, colors.teal[50], colors.teal[100], colors.teal[200]];
    const foregrounds = [...Object.values(colors.ink), colors.teal[600], colors.teal[700]];
    for (const surface of surfaces) {
      expect(luminance(surface)).toBeLessThan(0.06);
      for (const foreground of foregrounds) expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['light', 'dark'] as const)('separates filled action colors from text accents in %s', (scheme) => {
    const roles = getSawaaRoles(scheme);
    for (const stop of roles.action.gradient) {
      expect(contrast(roles.action.foreground, stop)).toBeGreaterThanOrEqual(4.5);
      // PrimaryButton's maximum white specular overlay is 6% at the top edge.
      const sheenComposite = '#' + stop.slice(1).match(/.{2}/g)!.map(channel =>
        Math.round(parseInt(channel, 16) * 0.94 + 255 * 0.06).toString(16).padStart(2, '0'),
      ).join('');
      expect(contrast(roles.action.foreground, sheenComposite)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('maps every shared surface and text role rather than leaving light islands', () => {
    const colors = buildTheme(null, 'dark').colors;
    for (const key of ['background', 'surface', 'surfaceLow', 'surfaceHigh', 'white'] as const) {
      expect(luminance(colors[key])).toBeLessThan(0.06);
      expect(contrast(colors.textMuted, colors[key])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
