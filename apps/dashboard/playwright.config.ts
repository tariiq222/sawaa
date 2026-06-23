/**
 * Playwright configuration for apps/dashboard (single-organization clinic).
 *
 * Prerequisites (run separately before `pnpm e2e`):
 *   1. Backend must be running:  npm run dev:backend  (port 5200)
 *   2. Docker stack (DB/Redis):  npm run docker:up
 *
 * The webServer block below spawns the Next.js dev server automatically
 * (or reuses an already-running one in non-CI mode).
 *
 * Projects:
 *   smoke  — e2e/smoke/**   ≤7 specs, <2 min, runs on every PR
 *   flows  — e2e/flows/**   full feature flows, runs nightly
 */
import { defineConfig, devices } from '@playwright/test';

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
    command: 'pnpm --filter dashboard dev',
    port: 5203,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:5200/api/v1',
    },
  },
});
