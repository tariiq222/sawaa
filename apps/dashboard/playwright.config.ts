/**
 * Playwright configuration for apps/dashboard (single-organization clinic).
 *
 * Prerequisites (run separately before `pnpm e2e`):
 *   1. Backend must be running:  npm run dev:backend  (port 5200)
 *   2. Docker stack (DB/Redis):  npm run docker:up
 *
 * The webServer block below spawns the Next.js server automatically (or reuses
 * an already-running one in non-CI mode).
 *
 * Dev vs. production server:
 *   By default the webServer uses `next dev` (Turbopack), which is convenient
 *   for the quick smoke suite. Turbopack compiles routes on-demand, however, so
 *   under load the FULL `flows` suite can stall in per-test `beforeEach`
 *   (login + first navigation) and even time out. For a reliable flows run use a
 *   production build by setting `PW_E2E_PROD=1` (auto-enabled in CI): the
 *   webServer then runs `next build && next start`, so route compilation happens
 *   once up-front instead of mid-test.
 *
 *     PW_E2E_PROD=1 pnpm --filter dashboard run e2e          # reliable flows
 *
 * Projects:
 *   smoke  — e2e/smoke/**   ≤7 specs, <2 min, runs on every PR
 *   flows  — e2e/flows/**   full feature flows, runs nightly
 */
import { defineConfig, devices } from '@playwright/test';

// Use a production build (build + start) for reliable, compile-stall-free runs.
// Defaults on in CI; opt in locally with PW_E2E_PROD=1.
const useProdServer = process.env.PW_E2E_PROD === '1' || !!process.env.CI;

export default defineConfig({
  testDir: './e2e',

  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.PW_DASHBOARD_URL ?? 'http://localhost:5203',
    headless: true,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: 'e2e/setup/**/*.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke',
      testMatch: 'e2e/smoke/**/*.spec.ts',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'flows',
      testMatch: 'e2e/flows/**/*.spec.ts',
      // The _manual/ folder holds long-running, one-shot exploration specs
      // (often with hardcoded service IDs) that must NOT run as part of the
      // nightly flow suite. They are picked up only when invoked directly.
      testIgnore: 'e2e/flows/_manual/**',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Production build (compile once up-front) for reliable full-suite runs;
    // Turbopack dev server otherwise for fast local smoke iteration.
    // `next start` reads the port from the PORT env (set below); the dev script
    // pins --port 5203 itself, so PORT is harmless there.
    command: useProdServer
      ? 'pnpm --filter dashboard build && pnpm --filter dashboard start'
      : 'pnpm --filter dashboard dev',
    port: 5203,
    // A cold production build needs much longer than a dev boot.
    timeout: useProdServer ? 300_000 : 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // Allow overriding the API URL via PW_API_URL so the same config works
      // against the real backend on a non-default host port (e.g. the local
      // docker stack maps the backend to 3450 instead of 5200).
      NEXT_PUBLIC_API_URL: `${process.env.PW_API_URL ?? 'http://localhost:5200'}/api/v1`,
      PORT: '5203',
    },
  },
});
