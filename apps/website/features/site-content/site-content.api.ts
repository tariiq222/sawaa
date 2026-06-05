import * as Sentry from '@sentry/nextjs';

import { getApiBase } from '@/lib/api-base';
import type { SiteSettingRow, SiteSettingsMap } from './types';

export async function fetchSiteSettings(prefix?: string): Promise<SiteSettingRow[]> {
  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
  try {
    const res = await fetch(`${getApiBase()}/public/content/site-settings${qs}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      Sentry.addBreadcrumb({
        category: 'fetch',
        level: 'warning',
        message: '[site-content] fetch failed — using empty settings',
        data: { status: res.status },
      });
      return [];
    }
    return (await res.json()) as SiteSettingRow[];
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'fetch',
      level: 'warning',
      message: '[site-content] fetch error — using empty settings',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    return [];
  }
}

export async function fetchSiteSettingsMap(prefix?: string): Promise<SiteSettingsMap> {
  const rows = await fetchSiteSettings(prefix);
  const map: SiteSettingsMap = new Map();
  for (const r of rows) map.set(r.key, r);
  return map;
}
