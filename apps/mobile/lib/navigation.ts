import type { Href, useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Leaves the current screen when it may have been opened with no history entry:
 * a deep link, a notification tap, or a guard redirect that replaced the route.
 * `router.back()` alone is a no-op there, which strands the user on the screen.
 * The group-qualified guest home avoids the client home with the same URL.
 * Its existing role dispatcher sends signed-in users to their tab shell;
 * callers can still supply an explicit fallback for a role-specific screen.
 */
export function goBackOrHome(router: Router, fallback: Href = '/(guest)/home'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}

/** Query params exactly as expo-router hands them to a screen or layout. */
export type RouteParams = Record<string, string | string[] | undefined>;

/**
 * Builds the `redirect` value a guard hands to login: the protected path the
 * user actually asked for, plus its query params. Those params are not
 * decoration — `/(client)/video-call?bookingId=…` is unusable without them.
 */
export function encodeRedirect(pathname: string, params?: RouteParams): string {
  const query = Object.entries(params ?? {})
    .filter(([key, value]) => key !== 'redirect' && value !== undefined && value !== '')
    .flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map(
        (entry) => `${encodeURIComponent(key)}=${encodeURIComponent(String(entry))}`,
      ),
    )
    .join('&');

  return query ? `${pathname}?${query}` : pathname;
}

/**
 * The route a guard is standing in front of, as a group-qualified path plus the
 * query params that are not already part of that path.
 *
 * Built from `useSegments()` rather than `usePathname()` because the pathname
 * drops group segments and that makes some paths ambiguous: the client tab home
 * and the public home are both `/home`, and only `/(client)/(tabs)/home` returns
 * the user to the tab shell once they sign in.
 */
export function guardedRoute(
  segments: readonly string[],
  params?: RouteParams,
): { pathname: string; params: RouteParams } | null {
  const parts: string[] = [];
  const consumed = new Set<string>();

  for (const segment of segments) {
    const catchAll = /^\[{1,2}\.\.\.([^\]]+?)\]{1,2}$/.exec(segment);
    if (catchAll) {
      const key = catchAll[1];
      const value = params?.[key];
      // Catch-all segments are optional, so a missing value is an empty path.
      const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
      if (values.length > 0) consumed.add(key);
      parts.push(...values.map((entry) => encodeURIComponent(String(entry))));
      continue;
    }

    const dynamic = /^\[([^\]]+)\]$/.exec(segment);
    if (dynamic) {
      const key = dynamic[1];
      const value = params?.[key];
      const single = Array.isArray(value) ? value[0] : value;
      // Without the value this route cannot be described; a half-built path
      // would land the user on a not-found screen after signing in.
      if (single === undefined) return null;
      consumed.add(key);
      parts.push(encodeURIComponent(String(single)));
      continue;
    }

    parts.push(segment);
  }

  const rest: RouteParams = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (consumed.has(key) || ROUTER_STATE_PARAMS.has(key)) continue;
    rest[key] = value;
  }

  return { pathname: `/${parts.join('/')}`, params: rest };
}

/**
 * The login href a role guard redirects to. It carries the requested route when
 * the router state describes it completely, and falls back to a plain login
 * href when it does not — login then uses its own role default after OTP.
 */
export function loginRedirectHref(segments: readonly string[], params?: RouteParams): Href {
  const route = guardedRoute(segments, params);
  if (!route) return '/(auth)/login' as Href;

  return {
    pathname: '/(auth)/login',
    params: { redirect: encodeRedirect(route.pathname, route.params) },
  } as Href;
}

const INTERNAL_PATH = /^\//;
const PROTOCOL_RELATIVE = /^\/\//;
/**
 * Params expo-router and React Navigation put on the route state themselves.
 * They surfaced in a guard redirect during live verification, and none of them
 * is an app param — expo-router even warns that `initial` is reserved.
 */
const ROUTER_STATE_PARAMS = new Set(['screen', 'params', 'pop', 'initial', 'path']);
// Auth screens answer to both `/(auth)/login` and `/login`, so both forms must
// be rejected — following one would drop the user back into the login flow.
const AUTH_PATH =
  /^\/(?:\(auth\)\/)?(?:login|register|otp-verify|forgot-password|reset-password|review-login|suspended)(?:\/|$)/;

/**
 * Accepts a redirect target only when it is an in-app, non-auth path. The value
 * arrives from a deep link, a notification payload, or a stale login URL, so
 * following it unchecked would turn login into an open redirect — and an auth
 * target would bounce the user straight back into the login flow.
 */
export function decodeRedirect(value?: string | string[]): Href | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !INTERNAL_PATH.test(candidate) || PROTOCOL_RELATIVE.test(candidate)) {
    return null;
  }

  const queryIndex = candidate.indexOf('?');
  const pathname = queryIndex === -1 ? candidate : candidate.slice(0, queryIndex);
  if (AUTH_PATH.test(pathname)) return null;

  const query = queryIndex === -1 ? '' : candidate.slice(queryIndex + 1);
  const params: Record<string, string | string[]> = {};

  for (const [key, value] of new URLSearchParams(query)) {
    const current = params[key];
    if (current === undefined) params[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else params[key] = [current, value];
  }

  return query ? ({ pathname, params } as Href) : (pathname as Href);
}
