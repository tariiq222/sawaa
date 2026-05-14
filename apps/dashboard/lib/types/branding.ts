/**
 * Branding Types — Deqah Dashboard
 */

export type WebsiteTheme = "SAWAA" | "PREMIUM"

export interface BrandingConfig {
  organizationNameAr: string
  organizationNameEn: string | null
  productTagline: string | null
  logoUrl: string | null
  faviconUrl: string | null
  colorPrimary: string | null
  colorPrimaryLight: string | null
  colorPrimaryDark: string | null
  colorAccent: string | null
  colorAccentDark: string | null
  colorBackground: string | null
  fontFamily: string | null
  fontUrl: string | null
  customCss: string | null
  websiteDomain: string | null
  activeWebsiteTheme: WebsiteTheme
  createdAt: string
  updatedAt: string
}

export type PublicBranding = Omit<BrandingConfig, "createdAt" | "updatedAt">

export type UpdateBrandingPayload =
  Pick<BrandingConfig, "organizationNameAr"> &
  Partial<Omit<BrandingConfig, "organizationNameAr" | "createdAt" | "updatedAt">>
