import { getApiBase } from '@/lib/api-base';
import type { SiteSettingRow, SiteSettingsMap } from './types';

export async function fetchSiteSettings(prefix?: string): Promise<SiteSettingRow[]> {
  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
  try {
    const res = await fetch(`${getApiBase()}/public/content/site-settings${qs}`, {
      next: { revalidate: 60, tags: ['site-content'] },
    });
    if (!res.ok) {
      console.warn(`[site-content] fetch failed: ${res.status} — using empty settings`);
      return [];
    }
    return (await res.json()) as SiteSettingRow[];
  } catch (err) {
    console.warn('[site-content] fetch error — using empty settings', err);
    return [];
  }
}

export async function fetchSiteSettingsMap(prefix?: string): Promise<SiteSettingsMap> {
  const rows = await fetchSiteSettings(prefix);
  const map: SiteSettingsMap = new Map();
  for (const r of rows) map.set(r.key, r);
  return map;
}
