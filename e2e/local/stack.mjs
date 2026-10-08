import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, openSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { seed } from './seed.mjs';
import { assertIsolatedDatabase } from './safety.mjs';

const root = resolve(import.meta.dirname, '../..');
const applePay = process.argv.includes('--apple-pay');
const id = Date.now().toString();
const runDir = resolve(root, '.e2e', `local-${id}`);
mkdirSync(runDir, { recursive: true, mode: 0o700 });
const project = `sawaa-e2e-${id}`;
// Start from an allowlist so inherited provider credentials cannot leak into tests.
const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, {
  NODE_ENV: 'development', TZ: 'Asia/Riyadh', PORT: '55200',
  LOCAL_DB_NAME: `sawaa_e2e_${id}`, LOCAL_DB_PASSWORD: randomBytes(24).toString('hex'),
  LOCAL_MINIO_PASSWORD: randomBytes(24).toString('hex'),
  REDIS_HOST: '127.0.0.1', REDIS_PORT: '55762', REDIS_PASSWORD: '', REDIS_DB: '0',
  MINIO_ENDPOINT: '127.0.0.1', MINIO_PORT: '55763', MINIO_ACCESS_KEY: 'e2e-local',
  MINIO_BUCKET: 'e2e-local', MINIO_USE_SSL: 'false',
  BACKEND_URL: 'http://127.0.0.1:55200', CORS_ORIGINS: 'http://127.0.0.1:55203,http://127.0.0.1:55205',
  NOTIFICATION_OUTBOX_CAPTURE_ENABLED: 'false', NOTIFICATION_OUTBOX_DELIVERY_ENABLED: 'false',
  WEB_CHAT_ENABLED: 'false', THROTTLER_DISABLED: 'true', E2E_TEST: 'true',
  MOBILE_OTP_DEV_BYPASS_CODE: '', MOBILE_OTP_FULL_BYPASS: 'false', MOBILE_REVIEW_CLIENT_ID: '',
  OPENAI_API_KEY: '', OPENROUTER_API_KEY: '', RESEND_API_KEY: '', AUTHENTICA_API_KEY: '',
  MOYASAR_PLATFORM_SECRET_KEY: '', MOYASAR_PUBLISHABLE_KEY: '', MOYASAR_WEBHOOK_SECRET: '',
  FCM_PROJECT_ID: '', FCM_CLIENT_EMAIL: '', FCM_PRIVATE_KEY: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
  SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: '', SENTRY_AUTH_TOKEN: '',
  MOYASAR_APPLE_PAY_ENABLED: applePay ? 'true' : 'false',
  MOYASAR_APPLE_PAY_MERCHANT_ID: applePay ? 'merchant.sa.sawa.app' : '',
  MOYASAR_APPLE_PAY_MERCHANT_LABEL: applePay ? 'Sawaa E2E Sandbox' : '',
  NEXT_TELEMETRY_DISABLED: '1', E2E_TELEMETRY_DISABLED: '1',
  E2E_WEBSITE_URL: 'http://127.0.0.1:55205', E2E_DASHBOARD_URL: 'http://127.0.0.1:55203',
  NEXT_PUBLIC_API_URL: 'http://127.0.0.1:55200/api/v1', INTERNAL_API_URL: 'http://127.0.0.1:55200',
  WEBSITE_API_PROXY_URL: 'http://127.0.0.1:55200', EXPO_NO_DOTENV: '1',
  PUBLIC_WEBSITE_URL: 'http://127.0.0.1:55205',
  EXPO_PUBLIC_API_URL: 'http://127.0.0.1:55200/api/v1',
  E2E_LOCAL_FIXTURE: resolve(runDir, 'fixture.json'), E2E_LOCAL_RUN_DIR: runDir,
});
env.DATABASE_URL = `postgresql://e2e:${env.LOCAL_DB_PASSWORD}@127.0.0.1:55761/${env.LOCAL_DB_NAME}`;
env.MINIO_SECRET_KEY = env.LOCAL_MINIO_PASSWORD;
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_CLIENT_ACCESS_SECRET', 'JWT_CLIENT_REFRESH_SECRET', 'OTP_SECRET', 'CHAT_GUEST_TOKEN_SECRET']) env[key] = randomBytes(32).toString('hex');
for (const key of ['AI_PROVIDER_ENCRYPTION_KEY', 'MOYASAR_ENCRYPTION_KEY', 'SMS_PROVIDER_ENCRYPTION_KEY', 'ZOOM_PROVIDER_ENCRYPTION_KEY', 'EMAIL_PROVIDER_ENCRYPTION_KEY']) env[key] = randomBytes(32).toString('base64');
env.PLATFORM_SETTINGS_KEY = randomBytes(32).toString('hex');
assertIsolatedDatabase(env.DATABASE_URL);
const children = [];
const compose = ['compose', '-p', project, '-f', resolve(import.meta.dirname, 'compose.yml')];
function command(bin, args, cwd = root) {
  const result = spawnSync(bin, args, { cwd, env, stdio: ['ignore', openSync(resolve(runDir, 'setup.log'), 'a'), 'pipe'] });
  if (result.status !== 0) throw new Error(`${bin} ${args[0]} failed; see setup.log. ${result.stderr?.toString().slice(-1500)}`);
}
function start(name, bin, args, cwd) {
  const log = openSync(resolve(runDir, `${name}.log`), 'a');
  const child = spawn(bin, args, { cwd, env, detached: true, stdio: ['ignore', log, log] });
  children.push(child);
  child.on('error', err => console.error(`${name}: ${err.message}`));
  return child;
}
async function available(port) {
  await new Promise((ok, fail) => { const s = createServer(); s.once('error', fail); s.listen(port, '127.0.0.1', () => s.close(ok)); });
}
async function ready(url, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Health timeout: ${url}; logs: ${runDir}`);
}
let composeStarted = false;
async function shutdown() {
  for (const child of children) {
    if (child.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  }
  if (composeStarted) command('docker', [...compose, 'down']); // Retains this run's named volumes.
}
process.once('SIGINT', () => { void shutdown().finally(() => process.exit(0)); });
process.once('SIGTERM', () => { void shutdown().finally(() => process.exit(0)); });
try {
  for (const port of [55200, 55203, 55205, 55761, 55762, 55763]) await available(port);
  composeStarted = true;
  command('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '90']);
  await ready('http://127.0.0.1:55763/minio/health/live');
  command('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], resolve(root, 'apps/backend'));
  const { password } = await seed(env, env.E2E_LOCAL_FIXTURE);
  Object.assign(env, { E2E_USER_DASHBOARD_USERNAME: 'staff@example.test', E2E_USER_DASHBOARD_PASSWORD: password,
    E2E_USER_CLIENT_USERNAME: '+966550000101', E2E_USER_CLIENT_PASSWORD: password });
  writeFileSync(resolve(runDir, 'environment.json'), JSON.stringify(env, null, 2), { mode: 0o600 });
  writeFileSync(resolve(runDir, 'ownership.json'), JSON.stringify({ project, runDir, createdAt: new Date().toISOString() }, null, 2));
  // Run outside apps/backend so Nest cannot read that checkout's .env files.
  start('backend', 'node', [resolve(root, 'apps/backend/dist/src/main.js')], runDir);
  await ready('http://127.0.0.1:55200/api/v1/health');
  start('website', 'pnpm', ['exec', 'next', 'dev', '--port', '55205', '--hostname', '127.0.0.1'], resolve(root, 'apps/website'));
  start('dashboard', 'pnpm', ['exec', 'next', 'dev', '--port', '55203', '--hostname', '127.0.0.1'], resolve(root, 'apps/dashboard'));
  await Promise.all([ready(env.E2E_WEBSITE_URL), ready(env.E2E_DASHBOARD_URL)]);
  console.log(`READY ${runDir}`);
  console.log('Stop with Ctrl-C; only this run’s processes and Compose project are stopped, volumes retained.');
  await new Promise(() => {});
} catch (error) {
  console.error(error.message);
  await shutdown();
  process.exitCode = 1;
}
