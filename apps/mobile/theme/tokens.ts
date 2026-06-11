import type { PublicBranding } from '@sawaa/shared';
import {
  colors,
  typography,
  spacing,
  radius,
  rnShadows,
  animations,
} from '@sawaa/shared/tokens';

// Fixed brand palette (teal + beige). Branding colors are no longer dynamic —
// these are locked in code and ignore the PublicBranding API response.
const FIXED_PRIMARY = '#55CCB0';
const FIXED_ACCENT = '#E7DBC4';
const FIXED_BACKGROUND = '#EAF8F4';

const darkColorOverrides = {
  surface: '#0c2424',
  surfaceElevated: '#11302f',
  background: '#0a1f1e',
  textPrimary: '#e8f4f2',
  textSecondary: '#9fbcba',
  border: 'rgba(255,255,255,0.14)',
} as const;

// Only overrides keys that actually exist in the light colors object.
function pickExisting<
  TBase extends Record<string, unknown>,
  TOverrides extends Record<string, string>,
>(
  base: TBase,
  overrides: TOverrides,
): Partial<Record<Extract<keyof TOverrides, keyof TBase>, string>> {
  const out: Partial<Record<Extract<keyof TOverrides, keyof TBase>, string>> = {};
  for (const key of Object.keys(overrides) as Array<Extract<keyof TOverrides, keyof TBase>>) {
    if (key in base) out[key] = overrides[key];
  }
  return out;
}

// `branding` is still accepted so call sites don't break, but theme colors are
// always the fixed palette above — the argument is intentionally unused.
export function buildTheme(_branding?: PublicBranding | null, scheme: 'light' | 'dark' = 'light') {
  return {
    colors: {
      ...colors,
      primary: FIXED_PRIMARY,
      accent: FIXED_ACCENT,
      background: scheme === 'dark' ? darkColorOverrides.background : FIXED_BACKGROUND,
      ...(scheme === 'dark' ? pickExisting(colors, darkColorOverrides) : {}),
    },
    typography,
    spacing,
    radius,
    shadows: rnShadows,
    animations,
  } as const;
}

export const theme = buildTheme();
export type AppTheme = ReturnType<typeof buildTheme>;
