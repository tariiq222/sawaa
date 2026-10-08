import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';

// Exact UI actions only: no model provider or paid fallback is used.
export default {
  tests: ['tests/**/*.e2e.ts'], workers: 1, retries: 0,
  timeout: 90000, assertionTimeout: 15000,
  targets: [{
    name: 'ios', engine: mobile({ platform: 'ios', device: 'Sawaa Booking QA' }),
    app: { bundleId: 'sa.sawa.app', environment: 'test', launchArguments: [
      '--initialUrl', 'http://localhost:8081', '-EXDevMenuShowsAtLaunch', 'NO',
      '-EXDevMenuIsOnboardingFinished', 'YES', '-EXDevMenuShowFloatingActionButton', 'NO',
    ] },
  }],
} satisfies E2EConfig;
