import { getApiBase } from './api-base';

export class PublicFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`PublicFetchError: ${status}`);
    this.name = 'PublicFetchError';
  }
}

/**
 * Utility for public website fetches (Sawa single-tenant):
 * 1. Prefixes the request with the API base (`/api/v1`).
 * 2. No X-Org-Id header needed — backend runs in single-tenant mode.
 * 3. Throws `PublicFetchError(status, body)` on non-2xx.
 */
export async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();

  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    throw new PublicFetchError(response.status, body);
  }

  return response.json() as Promise<T>;
}
