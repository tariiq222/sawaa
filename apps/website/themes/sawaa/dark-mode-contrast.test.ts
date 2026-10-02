import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = __dirname;
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

const css = read('theme.css');
const darkBlock = css.slice(css.indexOf("html[data-theme='dark'] .theme-sawaa,"));

function darkToken(name: string): string {
  const match = darkBlock.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`dark token --${name} is not a hex value`);
  return match[1];
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('Sawaa dark mode contrast', () => {
  it('keeps feature card labels readable on the dark card surface', () => {
    const surface = darkToken('surface');
    expect(contrast(darkToken('sw-feature-sand-text'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkToken('sw-feature-midnight-text'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkToken('sw-feature-midnight-text'), darkToken('sw-feature-midnight-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('pairs the light primary and secondary fills with dark foreground text', () => {
    expect(contrast(darkToken('sw-primary-700-foreground'), darkToken('sw-primary-700'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkToken('sw-secondary-700-foreground'), darkToken('sw-secondary-700'))).toBeGreaterThanOrEqual(4.5);
  });

  it('does not hard-code white text on fills that turn light in dark mode', () => {
    for (const file of ['components/sections/clinics.tsx', 'components/therapists/therapists-grid.tsx']) {
      const source = read(file);
      expect(source).not.toMatch(/background: 'var\(--sw-(primary|secondary)-700\)',\s*color: '#fff'/);
    }
  });
});
