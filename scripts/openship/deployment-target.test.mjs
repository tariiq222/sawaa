import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const sha = 'a'.repeat(40);
const main = 'refs/heads/main';
function route(event, ref = main, target = '', acceptedSha = '') {
  return spawnSync(process.execPath, ['scripts/openship/deployment-target.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: '', GITHUB_EVENT_NAME: event, GITHUB_REF: ref,
      GITHUB_SHA: sha, SAWAA_TARGET: target, SAWAA_REQUESTED_SHA: acceptedSha },
  });
}
test('main pushes and PR builds use staging images while production requires an exact manual SHA', () => {
  for (const [event, ref, target, accepted, expected] of [
    ['push', main, '', '', 'staging'],
    ['pull_request', 'refs/pull/12/merge', '', '', 'staging'],
    ['workflow_dispatch', main, 'staging', '', 'staging'],
    ['workflow_dispatch', main, 'production', sha, 'production'],
  ]) {
    const result = route(event, ref, target, accepted);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'target=' + expected);
  }
});

test('invalid dispatch, stale SHA and topic branches fail without a deployment target', () => {
  for (const [event, ref, target, accepted] of [
    ['workflow_dispatch', main, '', ''],
    ['workflow_dispatch', main, 'production', ''],
    ['workflow_dispatch', main, 'production', 'b'.repeat(40)],
    ['workflow_dispatch', 'refs/heads/topic', 'production', sha],
    ['workflow_dispatch', 'refs/heads/topic', 'staging', ''],
    ['push', 'refs/heads/develop', '', ''],
  ]) {
    const result = route(event, ref, target, accepted);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /branch|target|SHA/i);
  }
});
