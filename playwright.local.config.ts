import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { assertIsolatedDatabase } from './e2e/local/safety.mjs';

const runDir = process.env.E2E_LOCAL_RUN_DIR;
const fixturePath = process.env.E2E_LOCAL_FIXTURE;
const localRunName = runDir ? relative(resolve(__dirname, '.e2e'), runDir) : '';
if (!runDir || !fixturePath || resolve(runDir) !== runDir || resolve(fixturePath) !== fixturePath
  || !/^local-\d+$/.test(localRunName)
  || fixturePath !== resolve(runDir, 'fixture.json')) {
  throw new Error('Run Playwright only through e2e/local/with-env.mjs with the isolated fixture environment.');
}
const owner = JSON.parse(readFileSync(resolve(runDir, 'ownership.json'), 'utf8'));
const runId = runDir.match(/\/local-(\d+)$/)?.[1];
if (!runId || owner.runDir !== runDir || owner.project !== `sawaa-e2e-${runId}`) {
  throw new Error('Invalid local E2E ownership; refusing to load Playwright tests.');
}
assertIsolatedDatabase(process.env.DATABASE_URL);
if (process.env.NODE_ENV !== 'development' || process.env.E2E_TEST !== 'true'
  || process.env.E2E_WEBSITE_URL !== 'http://127.0.0.1:55205'
  || process.env.E2E_DASHBOARD_URL !== 'http://127.0.0.1:55203') {
  throw new Error('Local Playwright requires the isolated Sawaa E2E environment and fixed localhost origins.');
}

// Keep browsers inside the isolated stack: every request goes to a closed proxy
// port except the three app origins. `<-loopback>` stops Chromium's implicit
// localhost bypass, so other local services and literal IPs are blocked too,
// whether reached by navigation, page scripts or clicked links.
const appOrigins = ['127.0.0.1:55200', '127.0.0.1:55203', '127.0.0.1:55205'];
const loopbackOnly = { proxy: { server: 'http://127.0.0.1:9', bypass: ['<-loopback>', ...appOrigins].join(',') } };

export default defineConfig({
  testDir: './e2e/playwright',
  outputDir: resolve(runDir, 'playwright-output'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(runDir, 'playwright-report.json') }],
  ],
  projects: [
    {
      name: 'website',
      // seed.spec.ts is the default seed the planner/generator create when none is given.
      testMatch: ['website/**/*.spec.ts', 'seed.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:55205',
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        ...loopbackOnly,
      },
    },
    {
      name: 'dashboard',
      testMatch: ['dashboard/**/*.spec.ts', 'seed.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:55203',
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        ...loopbackOnly,
      },
    },
  ],
});
