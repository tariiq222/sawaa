import { withSentryConfig } from '@sentry/nextjs';

// Derive the API origin (scheme + host[:port]) from NEXT_PUBLIC_API_URL so the
// CSP connect-src can allow XHR/fetch to the backend. Falls back to the local
// dev backend. If the value is unparseable we just omit it rather than break.
function apiOrigin() {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5200/api/v1';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://localhost:5200';
  }
}

const sentryOrigin = process.env.SENTRY_URL || 'https://errors.webvue.pro';

// Content-Security-Policy for the public Next.js site.
//
// This ships as an ENFORCING policy (Content-Security-Policy) — violations are
// blocked by the browser. The policy stays deliberately permissive on scripts:
// Next.js needs 'unsafe-inline' for its injected styles, and (without a nonce
// setup) inline/eval scripts during hydration, so those are allowed. The value
// of enforcing even with those is real: object-src 'none', frame-ancestors
// 'none' (clickjacking), base-uri/form-action 'self', and a locked-down
// default-src/connect-src/img-src/font-src allowlist.
//
// TODO(security): tighten script-src by dropping 'unsafe-eval' and adopting
// nonce/hash-based inline scripts where the Next.js build allows it.
function buildCsp() {
  const api = apiOrigin();
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${api} https://*.sawaa.sa ${sentryOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

const securityHeaders = [
  // Enforcing — see buildCsp() note above.
  { key: 'Content-Security-Policy', value: buildCsp() },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  transpilePackages: ['@sawaa/api-client', '@sawaa/shared'],
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      { protocol: 'https', hostname: 'sawaa.sa' },
      { protocol: 'https', hostname: '*.sawaa.sa' },
      { protocol: 'https', hostname: 'errors.webvue.pro' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: 's3.*.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.sslip.io' },
      { protocol: 'https', hostname: 'fonts.gstatic.com' },
      { protocol: 'https', hostname: 'fonts.googleapis.com' },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: 'webvue',
  project: 'sawaa-website',
  url: process.env.SENTRY_URL || 'https://errors.webvue.pro/',
  silent: true,
  disableLogger: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
