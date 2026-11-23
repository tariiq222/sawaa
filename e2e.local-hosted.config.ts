import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { sol61 } from './e2e/models.ts';
import { fixture } from './e2e/local/verify.mjs';
import assert from 'node:assert/strict';

// SW-P03 is opt-in and real-provider: kept out of e2e.local.config.ts so the
// `payment` and `booking` tags never reach Moyasar hosted checkout by accident.
fixture(); // Fail closed before launching against an arbitrary deployment.
assert.equal(process.env.E2E_WEBSITE_URL, 'http://127.0.0.1:55205');
assert.equal(process.env.E2E_DASHBOARD_URL, 'http://127.0.0.1:55203');
assert.equal(process.env.BACKEND_URL, 'http://127.0.0.1:55200');
export default {
  tests: ['e2e/tests/website-payment.e2e.ts'],
  targets: [
    { name: 'website', engine: web(), app: { url: process.env.E2E_WEBSITE_URL! } },
  ], workers: 1, timeout: 300_000,
  credentials: {
    client: { username: process.env.E2E_USER_CLIENT_USERNAME!, password: process.env.E2E_USER_CLIENT_PASSWORD! },
  },
  agents: { default: { model: sol61, judge: sol61,
    providerOptions: { openai: { reasoningEffort: 'low' } }, maxModelCalls: 5 } },
} satisfies E2EConfig;
