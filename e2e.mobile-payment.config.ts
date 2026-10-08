import base from './e2e.mobile.config.ts';
import { fixture } from './e2e/local/verify.mjs';
const f = fixture();
export default {
  ...base,
  tests: ['e2e/tests/mobile-payment.e2e.ts'],
  timeout: 240_000,
  credentials: { mobile: { username: f.clients.payment.email, password: process.env.E2E_USER_CLIENT_PASSWORD! } },
};
