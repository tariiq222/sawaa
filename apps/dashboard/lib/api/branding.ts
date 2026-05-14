/**
 * Branding API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { BrandingConfig, UpdateBrandingPayload, PublicBranding } from "@/lib/types/branding"

/* ─── Queries ─── */

export async function fetchBranding(): Promise<BrandingConfig> {
  return api.get<BrandingConfig>("/dashboard/organization/branding")
}

export async function fetchPublicBranding(): Promise<PublicBranding> {
  return api.get<PublicBranding>("/public/branding")
}

/* ─── Mutations ─── */

export async function updateBranding(
  data: UpdateBrandingPayload,
): Promise<BrandingConfig> {
  return api.post<BrandingConfig>("/dashboard/organization/branding", data)
}
