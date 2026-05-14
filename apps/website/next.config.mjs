import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: new URL('../', import.meta.url).pathname,
  transpilePackages: ['@sawaa/api-client', '@sawaa/shared'],
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default withSentryConfig(nextConfig, {
  org: 'webvue',
  project: 'sawaa-website',
  url: 'http://100.124.231.44:8000/',
  silent: true,
  disableLogger: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
