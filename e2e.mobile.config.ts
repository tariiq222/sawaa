import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
import { mobileTools } from '@e2e-dev/mobile/tools';
import { sol61 } from './e2e/models.ts';
import { fixture } from './e2e/local/verify.mjs';
import { assertMobileBinding } from './e2e/local/mobile.mjs';

assertMobileBinding();
const f = fixture();
if (!process.env.E2E_IOS_DEVICE || !process.env.E2E_IOS_APP_PATH) {
  throw new Error('Dedicated E2E_IOS_DEVICE and verified E2E_IOS_APP_PATH are required');
}
const iphone = mobile({ platform: 'ios', device: process.env.E2E_IOS_DEVICE, session: 'sawaa-local-mobile' });
export default {
  tests: ['e2e/tests/mobile-booking.e2e.ts'], workers: 1, timeout: 180_000,
  targets: [{ name: 'mobile-local', engine: iphone, app: {
    bundleId: 'sa.sawa.app', appPath: process.env.E2E_IOS_APP_PATH,
  } }],
  credentials: { mobile: { username: f.clients.mobile.email, password: process.env.E2E_USER_CLIENT_PASSWORD! } },
  agents: { default: { model: sol61, judge: sol61, tools: mobileTools(iphone),
    providerOptions: { openai: { reasoningEffort: 'low' } }, maxModelCalls: 8 } },
} satisfies E2EConfig;
