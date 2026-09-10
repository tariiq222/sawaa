import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = join(process.cwd(), 'scripts/assert-critical-test-results.mjs');

function report(overrides = {}) {
  return {
    success: true,
    numFailedTests: 0,
    numPendingTests: 0,
    numTotalTests: 1,
    testResults: [
      {
        name: join(process.cwd(), 'apps/backend/test/e2e/finance/moyasar-webhook-idempotency.real-e2e-spec.ts'),
        status: 'passed',
        assertionResults: [{ fullName: 'does not process a webhook twice', status: 'passed' }],
      },
    ],
    ...overrides,
  };
}

async function runCli(input = {}) {
  const result = input.result ?? report();
  const exitCode = Object.hasOwn(input, 'exitCode') ? input.exitCode : '0';
  const required = input.required ?? 'apps/backend/test/e2e/finance/moyasar-webhook-idempotency.real-e2e-spec.ts';
  const dir = await mkdtemp(join(tmpdir(), 'sawaa-critical-results-'));
  const resultPath = join(dir, 'jest.json');
  await writeFile(resultPath, typeof result === 'string' ? result : JSON.stringify(result));
  const args = [script, '--results', resultPath];
  if (exitCode !== undefined) args.push('--exit-code', exitCode);
  args.push('--required', required);
  const child = spawnSync(process.execPath, args, { encoding: 'utf8' });
  await rm(dir, { recursive: true, force: true });
  return child;
}

test('accepts a complete critical Jest report with explicit zero exit code', async () => {
  const result = await runCli();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /critical test results: pass/i);
});

test('rejects a missing Jest report', async () => {
  const child = spawnSync(process.execPath, [script, '--results', join(tmpdir(), 'does-not-exist-jest.json'), '--exit-code', '0', '--required', 'apps/backend/test/e2e/finance/moyasar-webhook-idempotency.real-e2e-spec.ts'], { encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /missing|read/i);
});

test('rejects invalid JSON', async () => {
  const result = await runCli({ result: '{broken' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /json/i);
});

test('rejects a failed test report', async () => {
  const result = await runCli({ result: report({ success: false, numFailedTests: 1, numTotalTests: 1 }) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /failed|success/i);
});

test('rejects a report with pending tests, including all-skipped suites', async () => {
  const result = await runCli({
    result: report({
      success: true,
      numFailedTests: 0,
      numPendingTests: 1,
      numTotalTests: 1,
      testResults: [{
        name: join(process.cwd(), 'apps/backend/test/e2e/finance/moyasar-webhook-idempotency.real-e2e-spec.ts'),
        status: 'skipped',
        assertionResults: [{ fullName: 'skipped', status: 'pending' }],
      }],
    }),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pending|skipped/i);
});

test('rejects absent or nonzero exit success evidence', async () => {
  const absent = await runCli({ exitCode: undefined });
  assert.notEqual(absent.status, 0);
  assert.match(absent.stderr, /exit/i);

  const nonzero = await runCli({ exitCode: '7' });
  assert.notEqual(nonzero.status, 0);
  assert.match(nonzero.stderr, /exit/i);
});

test('rejects missing required paths and required paths with zero tests', async () => {
  const missing = await runCli({ required: 'apps/backend/test/e2e/finance/not-landed.real-e2e-spec.ts' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /required.*path|missing/i);

  const zero = await runCli({
    result: report({
      numTotalTests: 0,
      testResults: [{
        name: join(process.cwd(), 'apps/backend/test/e2e/finance/moyasar-webhook-idempotency.real-e2e-spec.ts'),
        status: 'passed',
        assertionResults: [],
      }],
    }),
  });
  assert.notEqual(zero.status, 0);
  assert.match(zero.stderr, /zero|test count|no tests/i);
});

test('rejects absent or malformed Jest success evidence', async () => {
  const absent = await runCli({ result: report({ success: undefined }) });
  assert.notEqual(absent.status, 0);
  assert.match(absent.stderr, /success/i);

  const malformed = await runCli({ result: report({ success: 'true' }) });
  assert.notEqual(malformed.status, 0);
  assert.match(malformed.stderr, /success/i);
});

test('fails closed for an absent or unsafe real-e2e database URL', () => {
  const absent = spawnSync(process.execPath, [script, '--validate-real-e2e-database-url'], {
    encoding: 'utf8',
    env: { ...process.env, REAL_E2E_DATABASE_URL: '' },
  });
  assert.notEqual(absent.status, 0);
  assert.match(absent.stderr, /REAL_E2E_DATABASE_URL is required/);

  const production = spawnSync(process.execPath, [script, '--validate-real-e2e-database-url'], {
    encoding: 'utf8',
    env: { ...process.env, REAL_E2E_DATABASE_URL: 'postgresql://test:test@localhost:5432/sawaa_production' },
  });
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /unsafe environment marker/);
  assert.doesNotMatch(production.stderr, /test:test/);
});
