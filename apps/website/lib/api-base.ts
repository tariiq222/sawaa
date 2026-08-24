const DEFAULT_ORIGIN = 'http://localhost:5200';
const API_PREFIX = '/api/v1';

export function getApiBase(): string {
  const origin =
    (process.env.INTERNAL_API_URL && process.env.INTERNAL_API_URL.length > 0
      ? process.env.INTERNAL_API_URL
      : undefined) ??
    (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.length > 0
      ? process.env.NEXT_PUBLIC_API_URL
      : undefined) ??
    DEFAULT_ORIGIN;
  const trimmed = origin.replace(/\/+$/, '');
  return trimmed.endsWith(API_PREFIX) ? trimmed : `${trimmed}${API_PREFIX}`;
}

/**
 * Origin (no path) of the API server. Use for `<link rel="preconnect">` so
 * the browser can warm up the TLS/DNS handshake before the first fetch.
 * Falls back to the same env chain as `getApiBase` then to the local
 * backend default.
 */
export function getApiOrigin(): string {
  const base = getApiBase();
  try {
    return new URL(base).origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}
