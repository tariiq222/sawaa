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
