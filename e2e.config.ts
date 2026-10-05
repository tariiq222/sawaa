import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { astra } from './e2e/models.ts';
import { dashboardUrl, websiteUrl } from './e2e/urls.ts';

// Start both apps and their backend dependencies before running this suite.
// Agent steps use only the runner's existing ChatGPT subscription login.
export default {
  tests: ['e2e/tests/**/*.e2e.ts'],
  targets: [
    { name: 'dashboard', engine: web(), app: { url: dashboardUrl } },
    { name: 'website', engine: web(), app: { url: websiteUrl } },
  ],
  agents: {
    default: {
      model: astra,
      judge: astra,
      providerOptions: { openai: { reasoningEffort: 'low' } },
      maxModelCalls: 5,
    },
  },
} satisfies E2EConfig;
