import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./record-deployment.mjs', import.meta.url));
const names = ['backend', 'dashboard', 'website', 'postgres', 'redis', 'minio'];
function evidence() {
  return {
    schemaVersion: 1, environment: 'staging', expectedCommit: 'a'.repeat(40),
    deployedCommit: 'a'.repeat(40), deploymentId: 'dep_example-1', status: 'ready',
    observedAt: new Date(Date.now() - 1000).toISOString(), verifiedBy: 'operator@example.org',
    services: names.map(name => ({ name, health: 'healthy', deploymentId: 'dep_example-1' })),
    checks: names.slice(0, 3).map(name => ({ name, status: 200 })),
  };
}
function fixture(t, raw) {
  const dir = mkdtempSync(join(tmpdir(), 'deployment-record-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = join(dir, 'evidence.json');
  const output = join(dir, 'record.json');
  if (raw !== undefined) writeFileSync(input, raw);
  return { input, output, run: (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' }) };
}

for (const environment of ['staging', 'production']) {
  test(`records complete ${environment} operator attestation`, t => {
    const data = { ...evidence(), environment };
    const raw = JSON.stringify(data);
    const f = fixture(t, raw);
    const before = Date.now();
    const result = f.run(f.input, f.output);
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(readFileSync(f.output, 'utf8'));
    assert.deepEqual(record, {
      schemaVersion: 1, environment, commit: 'a'.repeat(40), deploymentId: 'dep_example-1',
      observedAt: data.observedAt, recordedAt: record.recordedAt, status: 'verified',
      evidenceSha256: createHash('sha256').update(raw).digest('hex'),
      verificationSource: 'operator-attestation', verifiedBy: 'operator@example.org',
      services: data.services, checks: data.checks,
    });
    assert.ok(Date.parse(record.recordedAt) >= before && Date.parse(record.recordedAt) <= Date.now());
  });
}

const invalidCases = {
  'missing schema': e => { delete e.schemaVersion; },
  'unknown environment': e => { e.environment = 'preview'; },
  'failed deployment': e => { e.status = 'failed'; },
  'short commit': e => { e.expectedCommit = e.deployedCommit = 'abcdef'; },
  'uppercase commit': e => { e.expectedCommit = e.deployedCommit = 'A'.repeat(40); },
  'different commit': e => { e.deployedCommit = 'b'.repeat(40); },
  'invalid deployment id': e => { e.deploymentId = 'not-a-deployment'; },
  'different service deployment': e => { e.services[0].deploymentId = 'dep_other'; },
  'unhealthy service': e => { e.services[0].health = 'unhealthy'; },
  'missing service': e => { e.services.pop(); },
  'duplicate service': e => { e.services[5] = e.services[0]; },
  'missing checks': e => { delete e.checks; },
  'partial checks': e => { e.checks.pop(); },
  'duplicate checks': e => { e.checks[2] = e.checks[0]; },
  'failed HTTP check': e => { e.checks[0].status = 503; },
  'string HTTP status': e => { e.checks[0].status = '200'; },
  'stale observation': e => { e.observedAt = new Date(Date.now() - 86401000).toISOString(); },
  'future observation': e => { e.observedAt = new Date(Date.now() + 60000).toISOString(); },
  'noncanonical date': e => { e.observedAt = e.observedAt.replace('Z', '+00:00'); },
  'invalid date': e => { e.observedAt = '2026-02-30T00:00:00.000Z'; },
  'missing verifier': e => { delete e.verifiedBy; },
  'blank verifier': e => { e.verifiedBy = ''; },
  'verifier payload': e => { e.verifiedBy = 'Bearer SECRET_SENTINEL'; },
  'oversized verifier': e => { e.verifiedBy = 'x'.repeat(101); },
};
for (const [name, mutate] of Object.entries(invalidCases)) {
  test(`rejects ${name} without creating a record or exposing input`, t => {
    const data = evidence();
    mutate(data);
    data.secret = 'SECRET_SENTINEL';
    const f = fixture(t, JSON.stringify(data));
    const result = f.run(f.input, f.output);
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(f.output), false);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /SECRET_SENTINEL|Bearer/);
  });
}

test('whitelists fields and normalizes service and check order', t => {
  const data = evidence();
  data.secret = 'SECRET_SENTINEL';
  data.services[0].token = 'SECRET_SENTINEL';
  data.checks[0].url = 'https://SECRET_SENTINEL';
  data.services.reverse();
  data.checks.reverse();
  const f = fixture(t, JSON.stringify(data));
  assert.equal(f.run(f.input, f.output).status, 0);
  const raw = readFileSync(f.output, 'utf8');
  assert.doesNotMatch(raw, /SECRET_SENTINEL|token|https:/);
  const record = JSON.parse(raw);
  assert.deepEqual(record.services.map(s => s.name), names);
  assert.deepEqual(record.checks.map(c => c.name), ['backend', 'dashboard', 'website']);
});

for (const [name, raw] of [['missing input', undefined], ['malformed JSON', '{"SECRET_SENTINEL'], ['null input', 'null'], ['oversized input', ' '.repeat(65537)]]) {
  test(`rejects ${name}`, t => {
    const f = fixture(t, raw);
    const result = f.run(f.input, f.output);
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(f.output), false);
    assert.doesNotMatch(result.stderr, /SECRET_SENTINEL/);
  });
}

test('preserves an existing record', t => {
  const f = fixture(t, JSON.stringify(evidence()));
  writeFileSync(f.output, 'existing record');
  assert.notEqual(f.run(f.input, f.output).status, 0);
  assert.equal(readFileSync(f.output, 'utf8'), 'existing record');
});

test('rejects wrong argument counts without writing', t => {
  const f = fixture(t, JSON.stringify(evidence()));
  for (const args of [[], [f.input], [f.input, f.output, 'extra']]) {
    assert.notEqual(f.run(...args).status, 0);
    assert.equal(existsSync(f.output), false);
  }
});
