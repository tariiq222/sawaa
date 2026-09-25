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
    opaqueBg: '#F7F9FB',
    opaqueDarkBg: '#0c2424',
    opaqueDarkBorder: '#FFFFFF',
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

/** Same public shape in either appearance; values intentionally widen to strings. */
export type SawaaColors = {
  readonly [Group in keyof typeof sawaaColors]: {
    readonly [Key in keyof typeof sawaaColors[Group]]: string;
  };
};

const darkSawaaColors: SawaaColors = {
  teal: {
    50: '#102d2b', 100: '#153733', 200: '#1c413c',
    300: '#458d80', 400: '#55b49f', 500: '#65cdb4',
    600: '#7dddc7', 700: '#a0ebdb', 900: '#d1f5ec',
  },
  accent: { violet: '#b3a7ff', coral: '#ffa599', amber: '#f3c779', rose: '#f7a6c4', sky: '#8bc7f3' },
  ink: { 900: '#e8f4f2', 700: '#c1d6d2', 500: '#a5c1bc', 400: '#9fbcba' },
  glass: {
    ...sawaaColors.glass,
    bg: 'rgba(12, 36, 36, 0.55)',
    bgStrong: 'rgba(17, 48, 47, 0.88)',
    bgSoft: 'rgba(12, 36, 36, 0.42)',
    border: 'rgba(255,255,255,0.14)',
    borderSoft: 'rgba(255,255,255,0.09)',
    opaqueBg: '#0c2424',
  },
};

export function getSawaaColors(scheme: 'light' | 'dark'): SawaaColors {
  return scheme === 'dark' ? darkSawaaColors : sawaaColors;
}

/** Roles that must not borrow the text-accent ramp (mint in dark mode). */
const lightRoles = {
  background: '#EAF8F4', surface: '#F7F9FB', surfaceLow: '#F2F4F6', surfaceHigh: '#E6E8EA',
  accent: '#E7DBC4', focus: '#098a7d',
  action: { fill: '#087a6f', gradient: ['#087a6f', '#066962'] as const, foreground: '#FFFFFF', sheen: 'rgba(255,255,255,0.06)' },
  /**
   * Selected pill on a segmented track. Kept apart from `action`: a CTA keeps its
   * dark fill in both appearances, but a selection has to separate from the track
   * behind it, which the dark surface does not allow (2.50:1).
   */
  selection: { fill: '#087a6f', foreground: '#FFFFFF' },
  /**
   * On/off switch. The off track must read as a shape against a near-white card
   * (the old `surfaceLow` track was 1.04:1 — invisible), and the knob must read
   * against that track.
   */
  switch: { trackOff: '#C3CFD0', thumbOff: '#FFFFFF', trackOn: '#087a6f', thumbOn: '#FFFFFF' },
  backdrop: { base: '#0a1416', wash: 'rgba(11, 42, 46, 0.82)' },
  highlight: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.25)'] as const,
};
const darkRoles = {
  background: '#0a1f1e', surface: '#0c2424', surfaceLow: '#0e2927', surfaceHigh: '#173632',
  accent: '#dfc89f', focus: darkSawaaColors.teal[600],
  action: lightRoles.action,
  selection: { fill: darkSawaaColors.teal[600], foreground: darkSawaaColors.teal[50] },
  switch: {
    trackOff: '#27564F',
    thumbOff: darkSawaaColors.ink[500],
    trackOn: darkSawaaColors.teal[600],
    thumbOn: darkSawaaColors.teal[50],
  },
  backdrop: { base: '#0a1f1e', wash: 'rgba(6, 24, 24, 0.94)' },
  highlight: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.10)'] as const,
};

export function getSawaaRoles(scheme: 'light' | 'dark') {
  return scheme === 'dark' ? darkRoles : lightRoles;
}

/** Glass renderer effects live with the palette, never inside screen styles. */
export function getGlassEffects(isDark: boolean) {
  return {
    tint: (alpha: number) => `rgba(${isDark ? '12,36,36' : '255,255,255'},${alpha})`,
    border: (alpha: number) => `rgba(255,255,255,${isDark ? alpha * 0.35 : alpha})`,
    pressGlow: isDark
      ? 'radial-gradient(ellipse at center, rgba(125,221,199,0.12) 0%, rgba(125,221,199,0) 72%)'
      : 'radial-gradient(ellipse at center, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.25) 40%, rgba(255,255,255,0) 72%)',
    pressedShadow: 'inset 0 2px 10px rgba(21,79,87,0.18), inset 0 0 0 1px rgba(21,79,87,0.08)',
    restingShadow: 'inset 0 0 0 rgba(0,0,0,0)',
    innerShadow: 'inset 0 0 0 1px rgba(21,79,87,0.08)',
    sheen: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.15)',
    edgeShadow: isDark
      ? 'inset 0 1px 3px rgba(255,255,255,0.10), inset 0 -1px 2px rgba(255,255,255,0.03)'
      : 'inset 0 2px 6px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(255,255,255,0.2)',
  };
}

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
