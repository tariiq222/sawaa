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

// `branding` is still accepted so call sites don't break, but theme colors are
// always the fixed palette above — the argument is intentionally unused.
export function buildTheme(_branding?: PublicBranding | null) {
  return {
    colors: {
      ...colors,
      primary: FIXED_PRIMARY,
      accent: FIXED_ACCENT,
      background: FIXED_BACKGROUND,
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
