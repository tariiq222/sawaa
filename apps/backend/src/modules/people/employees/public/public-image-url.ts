import { createHash } from 'node:crypto';

/** Stable browser URL; the image endpoint renews the private object's signature on demand. */
export function normalizePublicImageUrl(value: string | null | undefined, employeeId?: string, apiPublicUrl?: string): string | null {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (employeeId && apiPublicUrl) {
    const base = apiPublicUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    const version = createHash('sha256').update(value).digest('hex').slice(0, 16);
    return `${base}/api/v1/public/employees/${encodeURIComponent(employeeId)}/image?v=${version}`;
  }
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) return value;
  return null;
}
