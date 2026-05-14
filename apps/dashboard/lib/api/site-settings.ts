/**
 * Site Settings API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type {
  SiteSettingRow,
  BulkUpsertSiteSettingsPayload,
  BulkUpsertResult,
} from "@/lib/types/site-settings"

export async function fetchSiteSettings(prefix?: string): Promise<SiteSettingRow[]> {
  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""
  return api.get<SiteSettingRow[]>(`/dashboard/content/site-settings${qs}`)
}

export async function bulkUpsertSiteSettings(
  payload: BulkUpsertSiteSettingsPayload,
): Promise<BulkUpsertResult> {
  return api.post<BulkUpsertResult>("/dashboard/content/site-settings", payload)
}
