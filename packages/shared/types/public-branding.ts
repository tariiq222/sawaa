/**
 * PublicBranding — single source of truth for branding across all Deqah apps.
 *
 * Consumed identically by:
 *   - apps/backend (returns it from GET /api/public/branding)
 *   - apps/website (SSR fetches it and injects CSS variables)
 *   - apps/dashboard (client fetches it and updates CSS variables at runtime)
 *   - apps/mobile (later — Phase 1.5b — maps it to NativeWind tokens)
 *
 * Any drift between consumers is a contract violation. Import this type;
 * never redefine it locally.
 */

export type WebsiteTheme = 'SAWAA' | 'PREMIUM';

export interface PublicBranding {
  // Identity
  organizationNameAr: string;
  organizationNameEn: string | null;
  productTagline: string | null;

  // Assets
  logoUrl: string | null;
  faviconUrl: string | null;

  // Colors
  colorPrimary: string | null;
  colorPrimaryLight: string | null;
  colorPrimaryDark: string | null;
  colorAccent: string | null;
  colorAccentDark: string | null;
  colorBackground: string | null;

  // Typography
  fontFamily: string | null;
  fontUrl: string | null;

  // Website
  websiteDomain: string | null;
  activeWebsiteTheme: WebsiteTheme;
}
