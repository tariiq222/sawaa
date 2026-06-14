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
