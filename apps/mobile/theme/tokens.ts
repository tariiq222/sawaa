import type { PublicBranding } from '@sawaa/shared';
import { getFontName } from './fonts';
import { getSawaaColors, getSawaaRoles, sawaaTokens } from './sawaa/tokens';
import {
  colors,
  typography,
  spacing,
  radius,
  rnShadows,
  animations,
} from '@sawaa/shared/tokens';

/**
 * Attention/negative status hues used by the light appearance.
 *
 * Every role inherited from `@sawaa/shared/tokens` still carries the pre-Sawaa
 * palette — royal blue `#354FD8`, lime `#82CC17` and slate/lavender neutrals —
 * so the theme re-points them at the fixed Sawaa palette in BOTH appearances.
 * The dark branch always did; light mode inherited the legacy values, which put
 * the old brand back on screen (`status.completed` rendered as the old royal
 * blue, `secondary[500]` as the old lime, `textMuted` as `#C4C5D7` — 1.6:1 on a
 * light card, i.e. invisible).
 *
 * The Sawaa accents are tuned for dark surfaces, so a status role only moves to
 * its accent when doing so does not lower contrast against `roles.surface`.
 * Pending (2.03:1 → 1.96:1), cancelled/failed (4.58:1 → 2.60:1) and refunded
 * (5.40:1 → 3.84:1) would all regress below the values the app ships today, so
 * light mode keeps the existing readable hue for those roles. These hues are
 * status conventions, not the old brand mark; swapping them would need darker
 * accent tokens from the design owner.
 *
 * Pinned by `theme/__tests__/light-mode-roles.test.ts`.
 */
const lightStatusInk = {
  pending: '#F59E0B',
  pendingCancellation: '#F97316',
  cancelled: '#DC2626',
  refunded: '#7C3AED',
  info: '#0EA5E9',
} as const;

/**
 * Shared roles that must resolve to the fixed Sawa palette in both appearances.
 * `white` is deliberately untouched in light mode: pure white is a legitimate
 * light card surface (dark remaps it because a white card would glare).
 */
function sharedRoleColors(scheme: 'light' | 'dark') {
  const palette = getSawaaColors(scheme);
  const roles = getSawaaRoles(scheme);
  const isDark = scheme === 'dark';

  // Dark surfaces need the bright teal; light surfaces need the deep one.
  const positive = isDark ? palette.teal[600] : palette.teal[700];
  const attention = isDark ? palette.accent.amber : lightStatusInk.pending;
  const danger = isDark ? palette.accent.coral : lightStatusInk.cancelled;
  const info = isDark ? palette.accent.sky : lightStatusInk.info;
  const violet = isDark ? palette.accent.violet : lightStatusInk.refunded;

  return {
    surface: roles.surface,
    surfaceLow: roles.surfaceLow,
    surfaceHigh: roles.surfaceHigh,
    black: palette.ink[900],
    textPrimary: palette.ink[900],
    textSecondary: isDark ? palette.ink[400] : palette.ink[700],
    textMuted: palette.ink[500],
    // A translucent white hairline only reads on a dark surface; the light
    // appearance uses the Sawa divider role instead.
    border: isDark ? palette.glass.border : roles.surfaceHigh,
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
    success: positive,
    warning: attention,
    error: danger,
    info,
    purple: violet,
    teal: positive,
    status: {
      pending: attention,
      confirmed: positive,
      completed: isDark ? palette.accent.sky : palette.teal[700],
      cancelled: danger,
      pendingCancellation: isDark ? palette.accent.amber : lightStatusInk.pendingCancellation,
    },
    payment: {
      pending: attention,
      paid: positive,
      refunded: violet,
      failed: danger,
    },
  };
}

// PublicBranding stays accepted for compatibility; the app uses its fixed brand.
export function buildTheme(_branding?: PublicBranding | null, scheme: 'light' | 'dark' = 'light') {
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
      // Shared surface + text roles, mapped in both appearances.
      ...sharedRoleColors(scheme),
      ...(scheme === 'dark'
        ? {
            // Legacy `white` is used as a surface; foregrounds use primaryForeground.
            white: roles.surface,
          }
        : {}),
    },
    typography: {
      ...typography,
      fontFamily: { arabic: getFontName('ar'), english: getFontName('en') },
    },
    spacing,
    radius,
    shadows: rnShadows,
    animations,
  } as const;
}

export const theme = buildTheme();
export type AppTheme = ReturnType<typeof buildTheme>;
