import { withSentryConfig } from '@sentry/nextjs';

// Note: Content-Security-Policy is now built PER-REQUEST in middleware.ts
// using a cryptographic nonce (no 'unsafe-inline', no 'unsafe-eval').
// The static headers() below ships the rest of the security headers only.

const securityHeaders = [
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
