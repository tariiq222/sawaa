import { apiRequest } from '../client'
import type { BrandingConfig, PublicBranding } from '@deqah/shared/types'

/**
 * Fetches public branding from the unified branding endpoint.
 * Used by mobile app on startup and dashboard pre-auth.
 */
export async function getBrandingPublic(): Promise<BrandingConfig> {
  return apiRequest<BrandingConfig>('/public/branding')
}

/**
 * GET /api/public/branding
 *
 * Framework-agnostic — safe to call from Next.js RSC, the browser, or React Native.
 * Returns the centralized PublicBranding shape. Consumers convert it to CSS variables
 * (website, dashboard) or native tokens (mobile). Drift from this type = contract bug.
 */
export async function getPublicBranding(): Promise<PublicBranding> {
  return apiRequest<PublicBranding>('/api/public/branding')
}
