import { getApiBase } from '@/lib/api-base';
import type { SiteSettingRow, SiteSettingsMap } from './types';

export async function fetchSiteSettings(prefix?: string): Promise<SiteSettingRow[]> {
  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
  const res = await fetch(`${getApiBase()}/public/content/site-settings${qs}`, {
    next: { revalidate: 60, tags: ['site-content'] },
  });
  if (!res.ok) throw new Error(`Failed to fetch site settings: ${res.status}`);
  return res.json() as Promise<SiteSettingRow[]>;
}

export async function fetchSiteSettingsMap(prefix?: string): Promise<SiteSettingsMap> {
  const rows = await fetchSiteSettings(prefix);
  const map: SiteSettingsMap = new Map();
  for (const r of rows) map.set(r.key, r);
  return map;
}
