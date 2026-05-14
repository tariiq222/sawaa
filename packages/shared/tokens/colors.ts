/**
 * Deqah Design System — Color Tokens
 * Source of truth: packages/shared/constants/brand.ts
 *
 * Primary: Royal Blue   #354FD8 (dark: #2438B0)
 * Secondary: Lime Green  #82CC17 (dark: #5A9010)
 * Text: #191C1E — never pure black
 * Shadows: #001551 tinted — never pure black
 */
export const colors = {
  primary: {
    50: '#EEF1FF',
    100: '#E1E6FF',
    200: '#C5CEFF',
    300: '#9DACF5',
    400: '#7184EA',
    500: '#354FD8',
    600: '#354FD8',
    700: '#2438B0',
    800: '#1E2E86',
    900: '#18235F',
  },
  secondary: {
    50: '#F5FCEB',
    100: '#EAF8D4',
    200: '#D7F0AA',
    300: '#BCE677',
    400: '#9DDA3F',
    500: '#82CC17',
    600: '#5A9010',
    700: '#426D0B',
    800: '#2D4B08',
    900: '#1D3205',
  },
  accent: {
    500: '#FF6B35',
  },
  gray: {
    50: '#F7F9FB',
    100: '#F2F4F6',
    200: '#E6E8EA',
    300: '#C4C5D7',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#191C1E',
  },
  success: '#059669',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#0EA5E9',
  purple: '#7C3AED',
  teal: '#0D9488',
  white: '#FFFFFF',
  black: '#191C1E',
  background: '#F7F9FB',
  surface: '#F7F9FB',
  surfaceLow: '#F2F4F6',
  surfaceHigh: '#E6E8EA',
  border: '#E6E8EA',
  textPrimary: '#191C1E',
  textSecondary: '#64748B',
  textMuted: '#C4C5D7',
  status: {
    pending: '#F59E0B',
    confirmed: '#059669',
    completed: '#354FD8',
    cancelled: '#DC2626',
    pendingCancellation: '#F97316',
  },
  payment: {
    pending: '#F59E0B',
    paid: '#059669',
    refunded: '#7C3AED',
    failed: '#DC2626',
  },
} as const;

export type ColorToken = typeof colors;
