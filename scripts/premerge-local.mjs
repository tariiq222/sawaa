#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { assertPlaywrightReport, assertE2eReport } from './premerge-local-results.mjs';

const root = resolve(import.meta.dirname, '..');
// The `e2e` CLI used for the booking journeys needs Node 22.12+; fail before the long build.
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 12)) {
  console.error(`pnpm test:premerge requires Node 22.12 or newer (found ${process.versions.node}); run \`nvm use\` with the repo's .nvmrc.`);
  process.exit(1);
}
if (process.argv.includes('--help')) {
  console.log('Usage: pnpm test:premerge\nBuilds and tests a fresh isolated local stack, records results, then stops its owned resources.');
  process.exit(0);
}
if (process.argv.length > 2) throw new Error('Unsupported argument; use pnpm test:premerge');
process.chdir(root);
const output = resolve(root, '.e2e', `premerge-${Date.now()}`);
mkdirSync(output, { recursive: true, mode: 0o700 });
const evidence = { startedAt: new Date().toISOString(), status: 'running', steps: [],
  scope: 'Local web/dashboard smoke and persisted pay-at-center booking; no mobile or provider acceptance',
};
const writeEvidence = () => writeFileSync(resolve(output, 'acceptance.json'), JSON.stringify(evidence, null, 2), { mode: 0o600 });

function candidate() {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split('\0').filter(Boolean).sort();
  const hash = createHash('sha256').update(sha);
  for (const file of files) {
    hash.update('\0').update(file).update('\0');
    const path = resolve(root, file);
    let stat;
    try { stat = lstatSync(path); }
    catch (error) { if (error.code === 'ENOENT') { hash.update('<deleted>'); continue; } throw error; }
    // Include the mode so an executable-bit-only change is a new candidate.
    hash.update(stat.mode.toString(8)).update('\0');
    if (stat.isSymbolicLink()) hash.update(readlinkSync(path));
    else if (stat.isDirectory()) hash.update('<directory>');
    else hash.update(readFileSync(path));
  }
  return { sha, digest: hash.digest('hex') };
}

let active;
let stack;
let interrupted = false;
function stop(child) {
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  interrupted = true;
  stop(active);
  stop(stack);
});
async function command(label, bin, args, env = process.env, timeout = 600_000) {
  if (interrupted) throw new Error('Local premerge check interrupted');
  console.log(`\n${label}`);
  const step = { label, startedAt: new Date().toISOString(), status: 'running' };
  evidence.steps.push(step);
  writeEvidence();
  const child = spawn(bin, args, { cwd: root, env, stdio: 'inherit', detached: true });
  active = child;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; stop(child); }, timeout);
  const hardTimer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
  }, timeout + 10_000);
  try {
    const [code, signal] = await once(child, 'exit');
    if (code !== 0 || signal || timedOut || interrupted) {
      step.status = 'failed';
      throw new Error(`${label} failed (${timedOut ? 'timeout' : signal ?? code})`);
    }
    step.status = 'passed';
  } catch (error) { step.status = 'failed'; throw error; }
  finally { clearTimeout(timer); clearTimeout(hardTimer); active = undefined; step.finishedAt = new Date().toISOString(); writeEvidence(); }
}

async function startStack() {
  if (interrupted) throw new Error('Local premerge check interrupted');
  stack = spawn(process.execPath, ['e2e/local/stack.mjs', '--port-set=premerge'], { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let captured = '';
  stack.stdout.on('data', data => { captured += data; });
  stack.stderr.on('data', data => { captured += data; });
  return await new Promise((ok, fail) => {
    const timer = setTimeout(() => { stop(stack); fail(new Error(`Local stack readiness timed out; see ${output}/stack.log`)); }, 300_000);
    const inspect = () => {
      writeFileSync(resolve(output, 'stack.log'), captured, { mode: 0o600 });
      const match = captured.match(/^READY ([^\r\n]+)\r?\n/m);
      if (match) { clearTimeout(timer); stack.stdout.removeListener('data', inspect); ok(match[1].trim()); }
    };
    stack.stdout.on('data', inspect);
    stack.once('error', error => { clearTimeout(timer); fail(error); });
    stack.once('exit', code => {
      clearTimeout(timer);
      writeFileSync(resolve(output, 'stack.log'), captured, { mode: 0o600 });
      fail(new Error(`Local stack exited (${code}); see ${output}/stack.log`));
    });
  });
}

try {
  evidence.candidate = candidate();
  writeEvidence();
  await command('Local isolation and acceptance guards', process.execPath,
    ['--test', 'e2e/local/safety.test.mjs', 'e2e/playwright/mcp-policy.test.mjs', 'scripts/premerge-local-results.test.mjs']);
  await command('Build shared types', 'pnpm', ['--filter', '@sawaa/shared', 'build']);
  await command('Build backend', 'pnpm', ['--filter', 'backend', 'build']);
  console.log('\nStarting fresh local test stack…');
  const runDir = await startStack();
  evidence.runDir = runDir;
  const owner = JSON.parse(readFileSync(resolve(runDir, 'ownership.json'), 'utf8'));
  if (owner.runDir !== runDir || !/^sawaa-e2e-\d+$/.test(owner.project)
    || !runDir.startsWith(resolve(root, '.e2e', 'local-'))) throw new Error('Invalid local stack ownership');
  const withEnv = ['e2e/local/with-env.mjs', runDir];
  await command('Playwright local smoke', process.execPath,
    [...withEnv, process.execPath, 'scripts/run-playwright.cjs', 'test', '--config', 'playwright.local.config.ts']);
  const playwrightReport = resolve(runDir, 'playwright-report.json');
  evidence.playwrightPassed = assertPlaywrightReport(JSON.parse(readFileSync(playwrightReport, 'utf8')));
  for (const [target, scenario] of [['website', 'SW-B03'], ['dashboard', 'SW-D02']]) {
    const reportDir = resolve(output, target);
    await command(`Local ${target} booking verification`, process.execPath,
      [...withEnv, 'pnpm', 'exec', 'e2e', 'run', '--config', 'e2e.local.config.ts',
        '--target', target, '--grep', scenario, '--output', reportDir]);
    evidence[`${target}Passed`] = assertE2eReport(JSON.parse(readFileSync(resolve(reportDir, 'report.json'), 'utf8')));
  }
  if (candidate().digest !== evidence.candidate.digest) throw new Error('Working tree changed during checks; rerun against the new candidate');
  if (stack.exitCode !== null || stack.signalCode !== null) throw new Error('Local stack exited before verification finished');
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'failed'; evidence.error = error.message; process.exitCode = 1;
  console.error(error.message);
} finally {
  if (stack?.pid && stack.exitCode === null && stack.signalCode === null) {
    const exited = once(stack, 'exit');
    stop(stack);
    const timer = setTimeout(() => {
      evidence.status = 'failed'; evidence.cleanup = 'timed-out'; process.exitCode = 1;
      try { process.kill(-stack.pid, 'SIGKILL'); } catch {}
    }, 30_000);
    try {
      const [code, signal] = await exited;
      evidence.cleanup ??= code === 0 && !signal ? 'stopped' : 'failed';
      if (evidence.cleanup !== 'stopped') { evidence.status = 'failed'; process.exitCode = 1; }
    } finally { clearTimeout(timer); }
  } else if (stack) {
    evidence.cleanup = stack.exitCode === 0 && !stack.signalCode ? 'stopped' : 'failed';
    if (evidence.cleanup !== 'stopped') { evidence.status = 'failed'; process.exitCode = 1; }
  }
  evidence.finishedAt = new Date().toISOString(); writeEvidence();
  console.log(`\nLocal premerge ${evidence.status}. Evidence: ${output}/acceptance.json`);
}
