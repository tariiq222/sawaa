export const typography = {
  fontFamily: {
    arabic: '"IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif',
    english: '"Inter", sans-serif',
    /** Numbers, dates, amounts — always render in DM Sans */
    numeric: '"DM Sans", "Inter", sans-serif',
    mono: '"IBM Plex Mono", monospace',
  },
  fontSize: {
    xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
    '2xl': 24, '3xl': 30, '4xl': 36,
  },
  fontWeight: {
    light: '300', regular: '400', medium: '500',
    semibold: '600', bold: '700',
  },
  lineHeight: {
    tight: 1.25, normal: 1.5, relaxed: 1.75,
  },
} as const;
