import type { PublicBranding } from '@sawaa/shared';
import { colors, typography, spacing, radius, rnShadows, animations } from '@sawaa/shared/tokens';
import { getSawaaColors, getSawaaRoles, sawaaTokens } from './sawaa/tokens';

// PublicBranding stays accepted for compatibility; the app uses its fixed brand.
export function buildTheme(_branding?: PublicBranding | null, scheme: 'light' | 'dark' = 'light') {
  const palette = getSawaaColors(scheme);
  const roles = getSawaaRoles(scheme);
  return {
    colors: {
      ...colors,
      primary: sawaaTokens.primary.light,
      accent: roles.accent,
      background: roles.background,
      // Explicit action roles: white labels must never sit on mint text accents.
      primaryForeground: roles.action.foreground,
      primaryFill: roles.action.fill,
      primaryGradient: roles.action.gradient,
      // Selected segment on a track — separate role, see lightRoles.selection.
      primarySelection: roles.selection.fill,
      primarySelectionForeground: roles.selection.foreground,
      // On/off switch colours — every switch renders through GlassSwitch.
      switch: roles.switch,
      focus: roles.focus,
      surfaceElevated: roles.surfaceHigh,
      ...(scheme === 'dark' ? {
        surface: roles.surface, surfaceLow: roles.surfaceLow, surfaceHigh: roles.surfaceHigh,
        // Legacy `white` is used as a surface; foregrounds use primaryForeground.
        white: roles.surface, black: palette.ink[900],
        textPrimary: palette.ink[900], textSecondary: palette.ink[400], textMuted: palette.ink[500],
        border: palette.glass.border,
        gray: {
          50: roles.surface, 100: roles.surfaceLow, 200: roles.surfaceHigh,
          300: palette.teal[200], 400: palette.ink[400], 500: palette.ink[500],
          600: palette.ink[700], 700: palette.ink[700], 800: palette.ink[900], 900: palette.ink[900],
        },
        secondary: {
          50: palette.teal[50], 100: palette.teal[100], 200: palette.teal[200],
          300: palette.teal[300], 400: palette.teal[400], 500: palette.teal[500],
          600: palette.teal[600], 700: palette.teal[700], 800: palette.teal[700], 900: palette.teal[900],
        },
        success: palette.teal[600], warning: palette.accent.amber, error: palette.accent.coral,
        info: palette.accent.sky, purple: palette.accent.violet, teal: palette.teal[600],
        status: {
          pending: palette.accent.amber, confirmed: palette.teal[600], completed: palette.accent.sky,
          cancelled: palette.accent.coral, pendingCancellation: palette.accent.amber,
        },
        payment: {
          pending: palette.accent.amber, paid: palette.teal[600],
          refunded: palette.accent.violet, failed: palette.accent.coral,
        },
      } : {}),
    },
    typography, spacing, radius, shadows: rnShadows, animations,
  } as const;
}

export const theme = buildTheme();
export type AppTheme = ReturnType<typeof buildTheme>;
