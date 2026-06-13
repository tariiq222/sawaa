/**
 * Sawaa design tokens — iOS 26 Liquid Glass palette.
 * Mirrors sawaa-design/v2/styles.css so the RN app stays visually in sync.
 */

export const sawaaColors = {
  teal: {
    50: '#e6fbf8',
    100: '#c5f0ea',
    200: '#9ae0d6',
    300: '#5dd5c7',
    400: '#2fc0b0',
    500: '#14a89a',
    600: '#098a7d',
    700: '#066962',
    900: '#053a34',
  },
  accent: {
    violet: '#7c6bed',
    coral: '#ef7a6b',
    amber: '#e8a84a',
    rose: '#e76b9a',
    sky: '#4fa3e0',
  },
  ink: {
    900: '#0a2a2a',
    700: '#2e4747',
    500: '#5c7878',
    400: '#84a0a0',
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.28)',
    bgStrong: 'rgba(255, 255, 255, 0.42)',
    bgSoft: 'rgba(255, 255, 255, 0.18)',
    border: 'rgba(255, 255, 255, 0.55)',
    borderSoft: 'rgba(255, 255, 255, 0.35)',
    darkBg: 'rgba(12, 36, 36, 0.55)',
    darkBorder: 'rgba(255, 255, 255, 0.18)',
  },
} as const;

export const sawaaRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const sawaaSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const sawaaBlur = {
  soft: 18,
  base: 24,
  strong: 30,
  dark: 28,
} as const;

/**
 * Official typography scale. `weight` is an RN `fontWeight` string —
 * pair with `getFontName(locale, weight)` so heading weights resolve to
 * the Handicrafts brand typeface and body weights to the system font.
 */
export const sawaaType = {
  display: { fontSize: 32, lineHeight: 42, weight: '700' },
  heading: { fontSize: 24, lineHeight: 30, weight: '700' },
  subheading: { fontSize: 18, lineHeight: 24, weight: '600' },
  body: { fontSize: 14, lineHeight: 20, weight: '400' },
  caption: { fontSize: 12, lineHeight: 16, weight: '500' },
  micro: { fontSize: 11, lineHeight: 14, weight: '600' },
} as const;

/** Semantic status colors mapped onto the fixed brand palette. */
export const sawaaSemantic = {
  success: sawaaColors.teal[500],
  warning: sawaaColors.accent.amber,
  danger: sawaaColors.accent.coral,
  info: sawaaColors.accent.sky,
} as const;

export type SawaaColors = typeof sawaaColors;

export type GlassVariant = 'regular' | 'strong' | 'clear';

export type GlassCfg = {
  mainBlur: number;
  mainTintAlpha: number;
  baseTintAlpha: number;
  bloomAlpha: number;
  borderAlpha: number;
  nativeBlur: number;
};

export const GLASS_CFG: Record<GlassVariant, GlassCfg> = {
  clear: {
    mainBlur: 18,
    mainTintAlpha: 0.04,
    baseTintAlpha: 0.12,
    bloomAlpha: 0.22,
    borderAlpha: 0.32,
    nativeBlur: 50,
  },
  regular: {
    mainBlur: 28,
    mainTintAlpha: 0.06,
    baseTintAlpha: 0.20,
    bloomAlpha: 0.32,
    borderAlpha: 0.40,
    nativeBlur: 70,
  },
  strong: {
    mainBlur: 40,
    mainTintAlpha: 0.09,
    baseTintAlpha: 0.28,
    bloomAlpha: 0.42,
    borderAlpha: 0.50,
    nativeBlur: 100,
  },
};

// Primary color system for the default Sawaa organization.
export const sawaaTokens = {
  // Color primitives
  colors: sawaaColors,

  // Branding tokens — fixed teal + beige palette.
  primary: {
    light: '#55CCB0',   // Sawa teal
    dark: '#0E4B43',    // Dark teal
  },
  secondary: {
    light: '#E7DBC4',   // Beige
    dark: '#CAAF7B',    // Dark beige
  },
  accent: {
    light: '#E7DBC4',   // Beige
    dark: '#CAAF7B',    // Dark beige
  },

  // Radius system
  radius: sawaaRadius,

  // Spacing system
  spacing: sawaaSpacing,

  // Blur system
  blur: sawaaBlur,

  // Typography scale
  type: sawaaType,

  // Semantic status colors
  semantic: sawaaSemantic,
} as const;

// Branding override helper for organization-specific customization.
export function getBrandingTokens(brandingConfig?: { primaryColor?: string; primaryColorDark?: string }) {
  if (!brandingConfig) return sawaaTokens;
  return {
    ...sawaaTokens,
    primary: {
      light: brandingConfig.primaryColor || sawaaTokens.primary.light,
      dark: brandingConfig.primaryColorDark || sawaaTokens.primary.dark,
    },
  };
}

export type SawaaTokens = typeof sawaaTokens;

export type SawaaType = typeof sawaaType;
export type SawaaTypeRole = keyof SawaaType;
export type SawaaSemantic = typeof sawaaSemantic;
export type SawaaSemanticTone = keyof SawaaSemantic;

/** iOS 27 concentric radii: a nested rounded element shares the parent's center,
 *  so its radius = outer radius − inset padding (floored at 4). */
export function concentricRadius(outer: number, padding: number): number {
  return Math.max(4, outer - padding);
}

/** Token-layer alpha tint — keeps ad-hoc transparency out of components.
 *  Appends an alpha byte to a 6-digit hex token color. */
export function withAlpha(hexColor: string, alpha: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hexColor}${byte.toString(16).padStart(2, '0')}`;
}
