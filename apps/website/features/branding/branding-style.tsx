import type { PublicBranding } from '@sawaa/shared';
import { PLATFORM_BRAND } from '@sawaa/shared';

const DEFAULTS: Record<string, string> = {
  '--primary': PLATFORM_BRAND.colors.primary,
  '--primary-light': PLATFORM_BRAND.colors.primaryLight,
  '--primary-dark': PLATFORM_BRAND.colors.primaryDark,
  '--accent': PLATFORM_BRAND.colors.accent,
  '--accent-dark': PLATFORM_BRAND.colors.accentDark,
  '--bg': PLATFORM_BRAND.colors.background,
  '--font-primary': "'IBM Plex Sans Arabic', system-ui, sans-serif",
};

export function BrandingStyle({ branding }: { branding: PublicBranding }) {
  const vars: Record<string, string> = {
    '--primary': branding.colorPrimary ?? DEFAULTS['--primary']!,
    '--primary-light': branding.colorPrimaryLight ?? DEFAULTS['--primary-light']!,
    '--primary-dark': branding.colorPrimaryDark ?? DEFAULTS['--primary-dark']!,
    '--accent': branding.colorAccent ?? DEFAULTS['--accent']!,
    '--accent-dark': branding.colorAccentDark ?? DEFAULTS['--accent-dark']!,
    '--bg': branding.colorBackground ?? DEFAULTS['--bg']!,
    '--font-primary': branding.fontFamily
      ? `'${branding.fontFamily}', system-ui, sans-serif`
      : DEFAULTS['--font-primary']!,
  };

  const css = `:root {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
