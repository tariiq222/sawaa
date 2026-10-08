import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { sol61 } from './e2e/models.ts';
import { dashboardUrl, websiteUrl } from './e2e/urls.ts';

const dashboardUsername = process.env.E2E_USER_DASHBOARD_USERNAME;
const dashboardPassword = process.env.E2E_USER_DASHBOARD_PASSWORD;

// Start both apps and their backend dependencies before running this suite.
// Agent steps use only the runner's existing ChatGPT subscription login.
export default {
  tests: ['e2e/tests/dashboard.e2e.ts', 'e2e/tests/website.e2e.ts'],
  targets: [
    { name: 'dashboard', engine: web(), app: { url: dashboardUrl } },
    { name: 'website', engine: web(), app: { url: websiteUrl } },
  ],
  workers: 1,
  credentials: dashboardUsername && dashboardPassword
    ? { dashboard: { username: dashboardUsername, password: dashboardPassword } }
    : {},
  agents: {
    default: {
      model: sol61,
      judge: sol61,
      providerOptions: { openai: { reasoningEffort: 'low' } },
      maxModelCalls: 5,
    },
  },
} satisfies E2EConfig;
