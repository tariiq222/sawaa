import type { PublicBranding } from '@sawaa/shared';

// Brand colors and font are FIXED in code (the dynamic branding system was
// removed). `branding` is still passed in (the call site also uses it for the
// org name/tagline elsewhere) but colors/font are no longer read from it.

const FIXED_VARS: Record<string, string> = {
  '--primary': '#55CCB0',
  '--primary-light': '#7CD8C2',
  '--primary-dark': '#0E4B43',
  '--accent': '#E7DBC4',
  '--accent-dark': '#CAAF7B',
  '--bg': '#EAF8F4',
  '--font-primary': "'Handicrafts', system-ui, sans-serif",
};

const FONT_FACES = [
  { file: 'Handicrafts-Regular.woff2', weight: 400 },
  { file: 'Handicrafts-Medium.woff2', weight: 500 },
  { file: 'Handicrafts-SemiBold.woff2', weight: 600 },
  { file: 'Handicrafts-Bold.woff2', weight: 700 },
  { file: 'Handicrafts-Black.woff2', weight: 900 },
];

export function BrandingStyle({ branding: _branding }: { branding: PublicBranding }) {
  const fontFaceCss = FONT_FACES.map(
    ({ file, weight }) =>
      `@font-face {\n  font-family: 'Handicrafts';\n  src: url('/fonts/${file}') format('woff2');\n  font-weight: ${weight};\n  font-style: normal;\n  font-display: swap;\n}`,
  ).join('\n');

  const rootCss = `:root {\n${Object.entries(FIXED_VARS)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`;

  const css = `${fontFaceCss}\n${rootCss}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
