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
 * 2. Throws `PublicFetchError(status, body)` on non-2xx.
 */
export async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();

  const headers = new Headers(init?.headers);
  // Only declare a JSON body when one is actually sent — bodyless GET/DELETE
  // requests must not advertise a Content-Type they don't carry.
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    throw new PublicFetchError(response.status, body);
  }

  // 204 No Content (and other empty bodies) have nothing to parse — calling
  // response.json() on them throws. Return undefined to honour the T contract.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json().catch(() => undefined)) as T;
}
