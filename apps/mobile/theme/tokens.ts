import type { PublicBranding } from '@deqah/shared';
import {
  colors,
  typography,
  spacing,
  radius,
  rnShadows,
  animations,
} from '@deqah/shared/tokens';

function isValidColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value);
}

export function buildTheme(branding?: PublicBranding | null) {
  const primary = isValidColor(branding?.colorPrimary)
    ? branding.colorPrimary
    : colors.primary[600];
  const accent = isValidColor(branding?.colorAccent)
    ? branding.colorAccent
    : colors.secondary[500];
  const background = isValidColor(branding?.colorBackground)
    ? branding.colorBackground
    : colors.gray[50];

  return {
    colors: {
      ...colors,
      primary,
      accent,
      background,
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
