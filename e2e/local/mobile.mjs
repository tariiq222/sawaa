import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertIsolatedDatabase } from './safety.mjs';

const API_URL = 'http://127.0.0.1:55200/api/v1';
const root = resolve(import.meta.dirname, '../..');
const digest = value => createHash('sha256').update(value).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const live = pid => {
  if (!Number.isSafeInteger(pid) || pid < 2) throw new Error('Invalid mobile runtime PID');
  process.kill(pid, 0);
};

function assertOwnedMetro(metroPid) {
  live(metroPid);
  const listeners = execFileSync('/usr/sbin/lsof', ['-nP', '-t', '-iTCP:8081', '-sTCP:LISTEN'], { encoding: 'utf8' })
    .trim().split(/\s+/).filter(Boolean).map(Number);
  if (!listeners.length) throw new Error('Owned Metro listener is missing');
  for (const pid of listeners) {
    const group = Number(execFileSync('/bin/ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).trim());
    if (group !== metroPid) throw new Error('Port 8081 belongs to another process group');
  }
}

function isolatedRun() {
  assertIsolatedDatabase(process.env.DATABASE_URL);
  if (process.env.EXPO_PUBLIC_API_URL !== API_URL || process.env.EXPO_NO_DOTENV !== '1'
    || process.env.NODE_ENV !== 'development') throw new Error('Mobile requires the exact isolated development API environment');
  if (!process.env.E2E_LOCAL_RUN_DIR || !process.env.E2E_LOCAL_FIXTURE) throw new Error('Run mobile through with-env.mjs');
  const runDir = realpathSync(process.env.E2E_LOCAL_RUN_DIR);
  const owner = json(resolve(runDir, 'ownership.json'));
  if (owner.runDir !== runDir || !/^sawaa-e2e-\d+$/.test(owner.project)) throw new Error('Invalid mobile run ownership');
  const fixturePath = realpathSync(process.env.E2E_LOCAL_FIXTURE);
  if (fixturePath !== resolve(runDir, 'fixture.json')) throw new Error('Mobile fixture must belong to this run');
  const fixture = json(fixturePath);
  if (!fixture.clients?.mobile?.id || !fixture.clients.mobile.email?.endsWith('@example.test')) throw new Error('Missing synthetic mobile client');
  const saved = json(resolve(runDir, 'environment.json'));
  for (const key of ['DATABASE_URL', 'E2E_LOCAL_FIXTURE', 'E2E_LOCAL_RUN_DIR', 'EXPO_PUBLIC_API_URL', 'EXPO_NO_DOTENV', 'E2E_USER_CLIENT_PASSWORD']) {
    if (!process.env[key] || process.env[key] !== saved[key]) throw new Error(`Mobile environment differs from owned run: ${key}`);
  }
  return { runDir, fixtureSha256: digest(readFileSync(fixturePath)), databaseSha256: digest(process.env.DATABASE_URL) };
}

function verifiedInput(device, inputPath) {
  if (!device || !inputPath) throw new Error('Dedicated simulator UUID and verified Debug .app are required');
  const inventory = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf8' }));
  const simulator = Object.entries(inventory.devices).flatMap(([runtime, devices]) =>
    devices.map(item => ({ ...item, runtime }))).find(item => item.udid === device);
  if (!simulator?.isAvailable || !simulator.runtime.includes('SimRuntime.iOS-')
    || !simulator.name.startsWith('Sawaa TesterArmy isolated')) throw new Error('Refusing a simulator outside dedicated TesterArmy ownership');
  const appPath = realpathSync(inputPath);
  if (!appPath.endsWith('.app') || !statSync(appPath).isDirectory()) throw new Error('A simulator .app directory is required');
  const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', resolve(appPath, 'Info.plist')], { encoding: 'utf8' }));
  if (plist.CFBundleIdentifier !== 'sa.sawa.app' || plist.DTPlatformName !== 'iphonesimulator'
    || typeof plist.CFBundleExecutable !== 'string' || basename(plist.CFBundleExecutable) !== plist.CFBundleExecutable
    || existsSync(resolve(appPath, 'main.jsbundle'))) throw new Error('Expected a Sawaa development simulator artifact without embedded JS');
  const executable = resolve(appPath, plist.CFBundleExecutable);
  if (!statSync(executable).isFile()) throw new Error('Mobile executable is missing');
  return { device, appPath, binarySha256: digest(readFileSync(executable)) };
}

// Imported by the config before mobile() or any device-mutating fixture runs.
export function assertMobileBinding() {
  const run = isolatedRun();
  const expectedPath = resolve(run.runDir, 'mobile-runtime.json');
  if (!process.env.E2E_MOBILE_ATTESTATION || realpathSync(process.env.E2E_MOBILE_ATTESTATION) !== expectedPath) throw new Error('Mobile requires a live wrapper attestation');
  if ((statSync(expectedPath).mode & 0o077) !== 0) throw new Error('Mobile attestation must be private');
  const manifest = json(expectedPath);
  const input = verifiedInput(process.env.E2E_IOS_DEVICE, process.env.E2E_IOS_APP_PATH);
  for (const [key, value] of Object.entries({ ...run, ...input, apiUrl: API_URL, expoNoDotenv: '1', metroPort: 8081 })) {
    if (manifest[key] !== value) throw new Error(`Mobile runtime binding mismatch: ${key}`);
  }
  live(manifest.pid);
  assertOwnedMetro(manifest.metroPid);
  return manifest;
}

async function vacantMetro() {
  // Exclusive wildcard binding refuses other IPv4/IPv6 listeners; never reuse or kill them.
  const server = createServer();
  try {
    await new Promise((yes, no) => { server.once('error', no); server.listen({ port: 8081, exclusive: true }, yes); });
  } catch { throw new Error('Metro port 8081 is occupied; stop only your owned Metro before running mobile'); }
  await new Promise((yes, no) => server.close(error => error ? no(error) : yes()));
}

async function main() {
  const [device, app] = process.argv.slice(2);
  const run = isolatedRun();
  const input = verifiedInput(device, app);
  const attestationPath = resolve(run.runDir, 'mobile-runtime.json');
  if (existsSync(attestationPath)) throw new Error('An existing mobile attestation must be investigated before another run');
  await vacantMetro();
  const metroEnv = Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL', 'TZ'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(metroEnv, { NODE_ENV: 'development', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: API_URL, EXPO_NO_TELEMETRY: '1', CI: '1' });
  const log = openSync(resolve(run.runDir, 'mobile-metro.log'), 'a', 0o600);
  const metro = spawn('pnpm', ['--dir', 'apps/mobile', 'exec', 'expo', 'start', '--localhost', '--port', '8081', '--clear'], {
    cwd: root, env: metroEnv, detached: true, stdio: ['ignore', log, log],
  });
  closeSync(log);
  let metroFailure;
  let runner;
  let stopping = false;
  let wroteAttestation = false;
  metro.once('error', () => { metroFailure = new Error('Owned Metro failed to start; inspect the private Metro log'); });
  metro.once('exit', () => { metroFailure = new Error('Owned Metro exited; inspect the private Metro log'); if (runner) runner.kill('SIGTERM'); });
  const stop = () => {
    stopping = true;
    runner?.kill('SIGTERM');
    if (metro.pid) { try { process.kill(-metro.pid, 'SIGTERM'); } catch {} }
    if (wroteAttestation) { try { unlinkSync(attestationPath); } catch {} wroteAttestation = false; }
  };
  const onSignal = () => { process.exitCode = 1; stop(); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    const deadline = Date.now() + 120_000;
    let ready = false;
    while (Date.now() < deadline && !stopping) {
      if (metroFailure) throw metroFailure;
      try {
        const response = await fetch('http://localhost:8081/status', { signal: AbortSignal.timeout(1000) });
        ready = response.ok && (await response.text()).trim() === 'packager-status:running';
      } catch {}
      if (ready) break;
      await new Promise(yes => setTimeout(yes, 250));
    }
    if (!ready || stopping || metroFailure) throw new Error('Owned Metro did not become ready');
    assertOwnedMetro(metro.pid);
    writeFileSync(attestationPath, JSON.stringify({ ...run, ...input, pid: process.pid, metroPid: metro.pid,
      apiUrl: API_URL, expoNoDotenv: '1', metroPort: 8081 }, null, 2), { mode: 0o600, flag: 'wx' });
    wroteAttestation = true;
    // agent-device clearKeychain omits the selected UDID in this version.
    // Address our verified dedicated simulator explicitly, never "booted".
    const devices = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf8' }));
    const selected = Object.values(devices.devices).flat().find(item => item.udid === device);
    if (selected.state !== 'Booted') execFileSync('xcrun', ['simctl', 'boot', device]);
    execFileSync('xcrun', ['simctl', 'bootstatus', device, '-b']);
    execFileSync('xcrun', ['simctl', 'keychain', device, 'reset']);
    const env = { ...process.env, E2E_MOBILE_ATTESTATION: attestationPath, E2E_IOS_DEVICE: device, E2E_IOS_APP_PATH: input.appPath };
    runner = spawn('pnpm', ['exec', 'e2e', 'run', '--config', 'e2e.mobile.config.ts', '--output', '.e2e/phase2-mobile'], { cwd: root, env, stdio: 'inherit' });
    const code = await new Promise((yes, no) => { runner.once('error', no); runner.once('exit', code => yes(code ?? 1)); });
    process.exitCode = stopping || metroFailure ? 1 : code;
  } finally {
    stop();
    // A stubborn child must not leave the owned development server behind.
    const deadline = Date.now() + 3000;
    if (metro.pid) {
      while (Date.now() < deadline) {
        try { process.kill(-metro.pid, 0); } catch { break; }
        await new Promise(yes => setTimeout(yes, 100));
      }
      try { process.kill(-metro.pid, 'SIGKILL'); } catch {}
    }
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
