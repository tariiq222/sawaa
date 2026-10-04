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

function normalizeWebsiteApiProxyUrl(value) {
  const raw = value?.trim();
  if (!raw) return null;

  let target;
  try {
    target = new URL(raw);
  } catch {
    throw new Error('WEBSITE_API_PROXY_URL must be an absolute HTTP(S) URL');
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('WEBSITE_API_PROXY_URL must use HTTP or HTTPS');
  }
  if (target.username || target.password || target.search || target.hash) {
    throw new Error('WEBSITE_API_PROXY_URL cannot include credentials, query, or fragment');
  }

  const apiPath = target.pathname.replace(/\/+$/, '');
  target.pathname = apiPath.endsWith('/api/v1') ? apiPath : `${apiPath}/api/v1`;
  return target.toString().replace(/\/+$/, '');
}

const websiteApiProxyUrl = normalizeWebsiteApiProxyUrl(process.env.WEBSITE_API_PROXY_URL);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    if (!websiteApiProxyUrl) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${websiteApiProxyUrl}/:path*`,
      },
    ];
  },
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
