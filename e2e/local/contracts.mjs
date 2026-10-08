import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Dedicated contract lane: real Postgres, mocked external providers as declared
// by test/setup-e2e.ts. It never uses the live UI fixture or provider credentials.
const root = resolve(import.meta.dirname, '../..');
const id = Date.now().toString();
const name = `sawaa-e2e-contracts-${id}`;
const reportDir = resolve(root, '.e2e', name);
mkdirSync(reportDir, { recursive: true, mode: 0o700 });
const password = randomBytes(24).toString('hex');
const database = `sawaa_e2e_contracts_${id}`;
const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, {
  NODE_ENV: 'test', TZ: 'Asia/Riyadh', DOTENV_CONFIG_PATH: '/dev/null',
  DATABASE_URL: `postgresql://e2e:${password}@127.0.0.1:55861/${database}`,
  PLATFORM_SETTINGS_KEY: randomBytes(32).toString('hex'),
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
  JWT_CLIENT_ACCESS_SECRET: randomBytes(32).toString('hex'),
});
env.REAL_E2E_DATABASE_URL = env.DATABASE_URL;
const suites = [
  'finance/moyasar-webhook-signature-http', 'finance/moyasar-webhook-idempotency',
  'finance/native-payment-concurrency', 'packages/reserve-consume-lifecycle',
  'packages/package-group-booking-http', 'packages/credit-return-cancel-paths',
  'bookings/client-cancellation-policy',
].map(p => `test/e2e/${p}.real-e2e-spec.ts`);
const log = openSync(resolve(reportDir, 'run.log'), 'a', 0o600);
let active;
let interrupted = false;
function onSignal() {
  interrupted = true;
  if (active?.pid) { try { process.kill(-active.pid, 'SIGTERM'); } catch {} }
}
process.once('SIGINT', onSignal);
process.once('SIGTERM', onSignal);
async function run(bin, args, cwd = root, cleanup = false) {
  if (interrupted && !cleanup) throw new Error('Contract run interrupted');
  await new Promise((ok, fail) => {
    active = spawn(bin, args, { cwd, env, detached: true, stdio: ['ignore', log, log] });
    active.once('error', fail);
    active.once('exit', code => {
      active = undefined;
      if (code === 0) ok();
      else fail(new Error(`${bin} failed (${code}); inspect ${reportDir}/run.log`));
    });
  });
}
let created = false;
try {
  // Docker fails closed if another owner holds the port or container name.
  await run('docker', ['create', '--name', name, '--network', 'bridge',
    '-p', '127.0.0.1:55861:5432', '-e', 'POSTGRES_USER=e2e',
    '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${database}`,
    '--health-cmd', `pg_isready -U e2e -d ${database}`, '--health-interval', '1s',
    'pgvector/pgvector:pg16']);
  created = true;
  await run('docker', ['start', name]);
  const deadline = Date.now() + 60_000;
  for (;;) {
    const health = spawnSync('docker', ['inspect', '--format', '{{.State.Health.Status}}', name], { env, encoding: 'utf8' });
    if (interrupted) throw new Error('Contract run interrupted');
    if (health.stdout.trim() === 'healthy') break;
    if (Date.now() >= deadline) throw new Error('Owned Postgres health timeout');
    await new Promise(r => setTimeout(r, 500));
  }
  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], resolve(root, 'apps/backend'));
  await run('pnpm', ['exec', 'jest', '--config', 'test/jest-e2e.json', '--runInBand',
    '--json', '--outputFile', resolve(reportDir, 'results.json'), '--runTestsByPath', ...suites], resolve(root, 'apps/backend'));
  writeFileSync(resolve(reportDir, 'scope.json'), JSON.stringify({
    suites, database: 'dedicated disposable Postgres on loopback:55861',
    externalProviders: 'mocked', nativeUI: false, realWebhookDelivery: false,
  }, null, 2));
  console.log(`PASS ${reportDir}`);
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  // Exact newly-created container only. Keep its anonymous data volume.
  if (created) await run('docker', ['rm', '-f', name], root, true);
  process.removeListener('SIGINT', onSignal);
  process.removeListener('SIGTERM', onSignal);
}
