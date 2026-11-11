import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForGitSha } from './verify-prebuilt-deploy.mjs';

const SHA = 'a'.repeat(40);
const reply = body => async () => ({ ok: true, status: 200, json: async () => body });
const noSleep = async () => {};

test('accepts the backend once it reports the built commit', async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ gitSha: calls < 3 ? 'b'.repeat(40) : SHA }) };
  };
  const body = await waitForGitSha('https://x/api/v1', SHA, { request, sleep: noSleep, attempts: 5 });
  assert.equal(body.gitSha, SHA);
  assert.equal(calls, 3);
});

test('fails when the running backend keeps reporting another commit', async () => {
  await assert.rejects(
    waitForGitSha('https://x/api/v1', SHA, { request: reply({ gitSha: 'unknown' }), sleep: noSleep, attempts: 2 }),
    /Running backend is not a{40}: gitSha unknown/,
  );
});

test('rejects a malformed expected commit', async () => {
  await assert.rejects(waitForGitSha('https://x/api/v1', 'main', { request: reply({}), sleep: noSleep }));
});

test('the read-only verifier accepts an explicit environment on main', () => {
  for (const target of ['staging', 'production']) {
    const result = spawnSync(process.execPath, ['scripts/openship/verify-prebuilt-deploy.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_REF_NAME: 'main', GITHUB_SHA: SHA, SAWAA_TARGET: target,
        GITHUB_TOKEN: '', OPENSHIP_READ_TOKEN: '' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /OpenShip and GitHub read credentials are required/);
  }
});
