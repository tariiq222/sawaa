const CSRF_BYPASS_PREFIXES = [
  '/api/v1/dashboard',
  '/api/v1/auth',
  '/api/v1/mobile',
  '/api/v1/public/sms/webhooks',
  '/api/v1/public/health',
  '/api/v1/public/metrics',
] as const;

const CSRF_BYPASS_EXACT_PATHS = new Set([
  '/api/v1/public/payments/webhook',
]);

export function shouldBypassCsrf(path: string): boolean {
  return CSRF_BYPASS_EXACT_PATHS.has(path) || CSRF_BYPASS_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
