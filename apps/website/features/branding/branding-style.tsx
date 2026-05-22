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

// SECURITY (P1): branding values come from a CMS table that any super-admin
// can edit. They flow into a server-rendered <style> block — a value
// containing `}` or `</style>` would break out of `:root{}` and inject
// arbitrary CSS (or worse, close the style tag and start an HTML element).
// Validate before interpolation rather than rely on consumers.

const HEX_OR_RGB = /^(?:#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\))$/;
const FONT_NAME = /^[A-Za-z0-9 _-]{1,64}$/;

function safeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return HEX_OR_RGB.test(value.trim()) ? value.trim() : fallback;
}

function safeFontFamily(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return FONT_NAME.test(value) ? `'${value}', system-ui, sans-serif` : fallback;
}

export function BrandingStyle({ branding }: { branding: PublicBranding }) {
  const vars: Record<string, string> = {
    '--primary': safeColor(branding.colorPrimary ?? undefined, DEFAULTS['--primary']!),
    '--primary-light': safeColor(branding.colorPrimaryLight ?? undefined, DEFAULTS['--primary-light']!),
    '--primary-dark': safeColor(branding.colorPrimaryDark ?? undefined, DEFAULTS['--primary-dark']!),
    '--accent': safeColor(branding.colorAccent ?? undefined, DEFAULTS['--accent']!),
    '--accent-dark': safeColor(branding.colorAccentDark ?? undefined, DEFAULTS['--accent-dark']!),
    '--bg': safeColor(branding.colorBackground ?? undefined, DEFAULTS['--bg']!),
    '--font-primary': safeFontFamily(branding.fontFamily ?? undefined, DEFAULTS['--font-primary']!),
  };

  const css = `:root {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
