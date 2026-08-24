/**
 * Per-request middleware:
 *   1. Sets a cryptographic nonce in the CSP header. Production CSP
 *      uses 'self' + nonce + 'strict-dynamic' + the FOUC-script hash
 *      with no 'unsafe-inline' and no 'unsafe-eval'. In non-production
 *      builds (dev / test), 'unsafe-eval' is appended to script-src
 *      because Next.js React Refresh and HMR evaluate code at runtime
 *      — without it, the client bundle refuses to boot and the booking
 *      wizard renders skeletons forever. The production CSP stays
 *      byte-for-byte locked down.
 *   2. Redirects unauthenticated users away from /account, /booking/confirm.
 *   3. Redirects authenticated users away from the auth pages to /account.
 *
 * Combining both concerns in one middleware means the auth redirect and
 * the CSP response header are emitted together (single round-trip), and
 * the matcher stays small.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/account', '/booking/confirm']
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function apiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5200/api/v1'
  try {
    return new URL(raw).origin
  } catch {
    return 'http://localhost:5200'
  }
}

const SENTRY_ORIGIN = process.env.SENTRY_URL || 'https://errors.webvue.pro'

/**
 * SHA-256 hash of the FOUC-prevention inline script emitted by
 * `app/layout.tsx` (`document.documentElement.classList.add('sw-js')`).
 * Hash-based whitelisting lets the script run without `unsafe-inline`
 * and without per-request nonces, so the same HTML response is valid
 * even after a cache hit. If the script body changes, regenerate the
 * hash (e.g. `printf 'document...' | openssl dgst -sha256 -binary | base64`).
 */
const FOUC_SCRIPT_HASH = "'sha256-DY/VAMtBGvhQC+0XhmB5TxS7gbObQ8KIXwJIZsXsGK4='"

/**
 * Build the CSP for this request.
 *
 * - script-src drops 'unsafe-inline' in favor of a per-request nonce
 *   plus the FOUC-script hash. 'strict-dynamic' propagates trust to
 *   scripts loaded by the nonced root script (Next.js's chunk loader),
 *   which removes the need for per-chunk nonces.
 * - In production, script-src is exactly
 *   `'self' 'nonce-${nonce}' 'strict-dynamic' 'sha256-...'` — no
 *   'unsafe-eval'. In non-production (dev / test) builds,
 *   `'unsafe-eval'` is appended because Next.js React Refresh and HMR
 *   rely on `eval`; without it the client bundle is blocked and pages
 *   render as permanent skeletons. NODE_ENV is read inside this
 *   function (not at module load) so tests can toggle it per-case.
 * - style-src still allows 'unsafe-inline' because Next.js injects
 *   styles inline during hydration; tightening this requires
 *   migrating every <style jsx> usage to CSS modules (out of scope).
 * - default-src stays 'self'; everything else is locked to the actual
 *   third-party origins we talk to (API, Sentry, fonts).
 */
function buildCsp(nonce: string): string {
  const api = apiOrigin()
  const isProduction = process.env.NODE_ENV === 'production'
  const scriptSrc = isProduction
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${FOUC_SCRIPT_HASH}`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${FOUC_SCRIPT_HASH}`
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${api} https://*.sawaa.sa ${SENTRY_ORIGIN}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}

export function middleware(request: NextRequest): NextResponse {
  // 1. Auth routing (existing behavior).
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('client_access_token')?.value
  const isAuthenticated = Boolean(accessToken)

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPath(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/account', request.url))
  }

  // 2. CSP nonce for everything else.
  const nonce = crypto
    .randomUUID()
    .replace(/-/g, '')
    .slice(0, 16)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  // Emit the CSP on the response too — the browser only sees response
  // headers, so this is the canonical source.
  response.headers.set('Content-Security-Policy', buildCsp(nonce))
  response.headers.set('x-nonce', nonce)
  return response
}

export const config = {
  // Match every route except static assets + image optimizer.
  // CSP is irrelevant for those and skipping saves CPU per request.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf)).*)',
  ],
}