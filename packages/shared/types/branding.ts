import { PLATFORM_BRAND } from '../constants/brand';

/**
 * BrandingConfig — the canonical shape returned by GET /public/branding.
 * All apps (dashboard, mobile) consume this type.
 */
export interface BrandingConfig {
  // Identity
  systemName:        string;
  systemNameAr:      string;
  productTagline:    string | null;
  // Assets
  logoUrl:           string | null;
  faviconUrl:        string | null;
  // Colors
  colorPrimary:      string;
  colorPrimaryLight: string;
  colorPrimaryDark:  string;
  colorAccent:       string;
  colorAccentDark:   string;
  colorBackground:   string;
  // Typography
  fontFamily:        string;
  fontUrl:           string | null;
}

export interface DerivedTokens {
  colorPrimaryGlow:  string;
  colorPrimaryUltra: string;
  colorAccentGlow:   string;
  colorAccentUltra:  string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  systemName:        PLATFORM_BRAND.nameEn,
  systemNameAr:      PLATFORM_BRAND.nameAr,
  productTagline:    PLATFORM_BRAND.taglineAr,
  logoUrl:           null,
  faviconUrl:        null,
  colorPrimary:      PLATFORM_BRAND.colors.primary,
  colorPrimaryLight: PLATFORM_BRAND.colors.primaryLight,
  colorPrimaryDark:  PLATFORM_BRAND.colors.primaryDark,
  colorAccent:       PLATFORM_BRAND.colors.accent,
  colorAccentDark:   PLATFORM_BRAND.colors.accentDark,
  colorBackground:   PLATFORM_BRAND.colors.background,
  fontFamily:        'IBM Plex Sans Arabic',
  fontUrl:           'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap',
};
