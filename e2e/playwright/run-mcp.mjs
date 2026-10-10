import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { assertIsolatedDatabase } from '../local/safety.mjs';
import { createMcpPolicy } from './mcp-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const e2eRoot = resolve(root, '.e2e');
const ports = { backend: 55200, dashboard: 55203, website: 55205 };

async function isHealthy(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500), redirect: 'manual' });
    return response.ok;
  } catch {
    return false;
  }
}

let runningServicesByProject;
try {
  const rows = execFileSync('docker', [
    'ps', '--filter', 'label=com.docker.compose.project',
    '--format', '{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.service"}}',
  ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
  runningServicesByProject = new Map();
  for (const row of rows.split('\n').filter(Boolean)) {
    const [project, service] = row.split('\t');
    if (!project || !service) continue;
    if (!runningServicesByProject.has(project)) runningServicesByProject.set(project, new Set());
    runningServicesByProject.get(project).add(service);
  }
} catch {
  throw new Error('Cannot verify the owned local Docker Compose project; refusing to start the Playwright agent server.');
}

const activeRuns = [];
const requestedRunDir = process.env.E2E_LOCAL_RUN_DIR ? resolve(process.env.E2E_LOCAL_RUN_DIR) : null;
for (const name of readdirSync(e2eRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)) {
  if (!/^local-\d+$/.test(name)) continue;
  const runDir = resolve(e2eRoot, name);
  if (requestedRunDir && requestedRunDir !== runDir) continue;
  try {
    const owner = JSON.parse(readFileSync(resolve(runDir, 'ownership.json'), 'utf8'));
    const env = JSON.parse(readFileSync(resolve(runDir, 'environment.json'), 'utf8'));
    const runId = name.slice('local-'.length);
    if (owner.runDir !== runDir || owner.project !== `sawaa-e2e-${runId}`) continue;
    const liveServices = runningServicesByProject.get(owner.project);
    if (!liveServices || !['postgres', 'redis', 'minio'].every(service => liveServices.has(service))) continue;
    assertIsolatedDatabase(env.DATABASE_URL);
    if (env.E2E_LOCAL_RUN_DIR !== runDir || env.E2E_LOCAL_FIXTURE !== resolve(runDir, 'fixture.json')
      || env.NODE_ENV !== 'development' || env.E2E_TEST !== 'true'
      || env.BACKEND_URL !== `http://127.0.0.1:${ports.backend}`
      || env.E2E_DASHBOARD_URL !== `http://127.0.0.1:${ports.dashboard}`
      || env.E2E_WEBSITE_URL !== `http://127.0.0.1:${ports.website}`
      || env.INTERNAL_API_URL !== `http://127.0.0.1:${ports.backend}`
      || env.NEXT_PUBLIC_API_URL !== `http://127.0.0.1:${ports.backend}/api/v1`
      || env.WEBSITE_API_PROXY_URL !== `http://127.0.0.1:${ports.backend}`
      || env.CORS_ORIGINS !== `http://127.0.0.1:${ports.dashboard},http://127.0.0.1:${ports.website}`
      || ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'RESEND_API_KEY', 'AUTHENTICA_API_KEY',
        'MOYASAR_PLATFORM_SECRET_KEY', 'MOYASAR_PUBLISHABLE_KEY', 'MOYASAR_WEBHOOK_SECRET',
        'FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
        'SENTRY_AUTH_TOKEN'].some(key => env[key])) continue;
    const healthy = await Promise.all([
      isHealthy(`${env.BACKEND_URL}/api/v1/health`),
      isHealthy(env.E2E_DASHBOARD_URL),
      isHealthy(env.E2E_WEBSITE_URL),
    ]);
    if (healthy.every(Boolean)) activeRuns.push(runDir);
  } catch {
    // Stale, partial, or malformed run directories are not eligible.
  }
}

if (activeRuns.length !== 1) {
  throw new Error(`Playwright Test Agents require exactly one healthy isolated local run; found ${activeRuns.length}.`);
}

const args = [
  resolve(root, 'e2e/local/with-env.mjs'), activeRuns[0], 'pnpm',
  '--dir', 'apps/dashboard', 'exec', 'node', '../../scripts/run-playwright.cjs',
  'run-test-mcp-server', '--headless', '--config', '../../playwright.local.config.ts',
];
const policyViolation = createMcpPolicy(root, Object.values(ports));

const child = spawn(process.execPath, args, { cwd: root, stdio: ['pipe', 'pipe', 'inherit'], detached: true });
// MCP stdio is newline-delimited JSON; relay whole lines so replies never interleave.
createInterface({ input: child.stdout }).on('line', line => process.stdout.write(`${line}\n`));
child.stdin.on('error', () => {}); // The child may exit while a request is in flight.
const requests = createInterface({ input: process.stdin });
requests.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { child.stdin.write(`${line}\n`); return; }
  const violation = Array.isArray(message) ? 'Batched MCP requests are not supported' : policyViolation(message);
  if (!violation) { child.stdin.write(`${line}\n`); return; }
  const id = Array.isArray(message) ? null : message.id;
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: violation }], isError: true } })}\n`);
}).on('close', () => child.stdin.end());
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
// Exit with the server so the MCP client sees the transport close instead of a hung connection.
child.on('close', (code, signal) => {
  requests.close();
  process.stdin.destroy();
  process.stdout.write('', () => process.exit(code ?? (signal ? 1 : 0)));
});
function stopGroup(signal) {
  if (!child.pid) return;
  try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  stopGroup(signal);
  const timer = setTimeout(() => stopGroup('SIGKILL'), 5000);
  timer.unref();
});
// Also close descendants when the MCP client closes its stdio transport.
child.once('exit', () => stopGroup('SIGTERM'));
