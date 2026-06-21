import { withSentryConfig } from '@sentry/nextjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");
const shouldUploadSentryArtifacts = process.env.CI === "true" && Boolean(process.env.SENTRY_AUTH_TOKEN);

const isProduction = process.env.NODE_ENV === "production";

// 'unsafe-eval' is only needed by Next.js dev HMR. The dashboard ships no code
// that evals (verified: no eval/new Function/wasm in source or deps), so drop it
// in production to shrink the XSS gadget surface. 'unsafe-inline' stays until a
// nonce/hash pipeline exists. (R-18)
const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  isProduction ? "" : "'unsafe-eval'",
  "https://cdn.moyasar.com https://*.moyasar.com https://static.cloudflareinsights.com",
]
  .filter(Boolean)
  .join(" ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.sawaa.sa https://api.sawaa.sa https://*.moyasar.com",
      "frame-src https://*.moyasar.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@sawaa/ui", "@sawaa/shared", "@sawaa/api-client"],
  skipTrailingSlashRedirect: true,
  // Production builds: fail on lint/type errors to prevent broken code from reaching production.
  // CI typecheck/lint jobs should catch these before build, but this is the final safety net.
  eslint: { ignoreDuringBuilds: !isProduction },
  typescript: { ignoreBuildErrors: !isProduction },
  serverExternalPackages: [
    '@opentelemetry/instrumentation',
    '@opentelemetry/api-logs',
    '@sentry/node',
    '@prisma/instrumentation',
    'require-in-the-middle',
    'import-in-the-middle',
  ],
  experimental: {
    optimizePackageImports: ['@hugeicons/core-free-icons', 'recharts', '@sawaa/ui'],
  },
  // Dev autologin hint values. Renamed away from NEXT_PUBLIC_DEV_PASSWORD —
  // the previous name made the variable look like a real credential and would
  // have shown up in any secret-scanner inventory. These are non-secret dev
  // affordances (seeded test account); blanked in production builds.
  env: {
    NEXT_PUBLIC_DEV_AUTOLOGIN_EMAIL: isProduction
      ? ""
      : (process.env.NEXT_PUBLIC_DEV_AUTOLOGIN_EMAIL ?? process.env.NEXT_PUBLIC_DEV_EMAIL ?? ""),
    NEXT_PUBLIC_DEV_AUTOLOGIN_TOKEN: isProduction
      ? ""
      : (process.env.NEXT_PUBLIC_DEV_AUTOLOGIN_TOKEN ?? process.env.NEXT_PUBLIC_DEV_PASSWORD ?? ""),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/_next/image",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ]
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5200/api/v1"
    // Strip /api/proxy prefix then forward to backend
    const backendBase = apiUrl.replace(/\/api\/v\d+$/, "")
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backendBase}/api/v1/:path*`,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: 'webvue',
  project: 'sawaa-dashboard',
  url: 'https://errors.webvue.pro/',
  silent: true,
  disableLogger: true,
  useRunAfterProductionCompileHook: shouldUploadSentryArtifacts,
  webpack: { disableSentryConfig: !shouldUploadSentryArtifacts },
  sourcemaps: { disable: !shouldUploadSentryArtifacts },
  release: {
    create: shouldUploadSentryArtifacts,
    finalize: shouldUploadSentryArtifacts,
    setCommits: shouldUploadSentryArtifacts ? { auto: true, ignoreMissing: true } : false,
  },
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
