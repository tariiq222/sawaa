const DEFAULT_ORIGIN = 'http://localhost:5100';
const API_PREFIX = '/api/v1';

export function getApiBase(): string {
  const origin =
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_ORIGIN;
  return `${origin.replace(/\/$/, '')}${API_PREFIX}`;
}
