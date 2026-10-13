/*
 * CSRF bypass policy.
 *
 * The decision is keyed on the transport, not only on the URL:
 *   - Machine callers (payment/SMS webhooks, health, metrics) never carry
 *     cookies and always bypass.
 *   - A request that carries the client session cookie (`client_access_token`)
 *     is a browser session, so CSRF is always enforced, whatever the path.
 *     This closes the gap where a browser calling /api/v1/mobile/* skipped
 *     CSRF only because of its URL prefix.
 *   - Staff surfaces (/dashboard, /auth) are bearer-only and always bypass.
 *   - Without that cookie (bearer-only or anonymous), the legacy prefix rules
 *     apply unchanged.
 *
 * The prefix list below is transitional: it goes away once the unified client
 * API lands and the transport alone decides. See
 * docs/architecture/client-api-unification.md section 4.1 and section 8.
 */

const ALWAYS_BYPASS_PREFIXES = [
  '/api/v1/public/sms/webhooks',
  '/api/v1/public/health',
  '/api/v1/public/metrics',
] as const;

const ALWAYS_BYPASS_EXACT_PATHS = new Set([
  '/api/v1/public/payments/webhook',
]);

// Staff surfaces authenticate with bearer tokens only and never read the
// client cookie, so a stray client cookie (e.g. localhost dev where the
// website and dashboard share the cookie jar) must not break them.
const STAFF_BYPASS_PREFIXES = [
  '/api/v1/dashboard',
  '/api/v1/auth',
] as const;

// Client surfaces: bypass only when no client session cookie is present.
const CLIENT_BEARER_BYPASS_PREFIXES = [
  '/api/v1/mobile',
  '/api/v1/client',
] as const;

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export interface CsrfPolicyInput {
  path: string;
  hasClientSessionCookie: boolean;
}

export function shouldBypassCsrf(input: CsrfPolicyInput): boolean {
  const { path, hasClientSessionCookie } = input;
  if (
    ALWAYS_BYPASS_EXACT_PATHS.has(path) ||
    matchesPrefix(path, ALWAYS_BYPASS_PREFIXES)
  ) {
    return true;
  }
  if (matchesPrefix(path, STAFF_BYPASS_PREFIXES)) {
    return true;
  }
  if (hasClientSessionCookie) {
    return false;
  }
  return matchesPrefix(path, CLIENT_BEARER_BYPASS_PREFIXES);
}
