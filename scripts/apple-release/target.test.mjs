import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveApiUrl } = require('../../apps/mobile/constants/api-url-validation.js');

test('staging release rejects the production API', () => {
  assert.throws(() => resolveApiUrl({ easBuildProfile: 'staging', configuredApiUrl: 'https://api.sawaa.sa/api/v1' }), /match staging/);
});
test('production release rejects the staging API', () => {
  assert.throws(() => resolveApiUrl({ easBuildProfile: 'production', configuredApiUrl: 'https://staging.sawaa.sa/api/v1' }), /match production/);
});
test('staging release cannot fall back to localhost', () => {
  assert.throws(() => resolveApiUrl({ easBuildProfile: 'staging' }), /required/);
});
test('each release accepts its fixed public API', () => {
  assert.equal(resolveApiUrl({ easBuildProfile: 'staging', configuredApiUrl: 'https://staging.sawaa.sa/api/v1' }), 'https://staging.sawaa.sa/api/v1');
  assert.equal(resolveApiUrl({ easBuildProfile: 'production', configuredApiUrl: 'https://api.sawaa.sa/api/v1' }), 'https://api.sawaa.sa/api/v1');
});

test('only long-lived branches can choose a release target', async () => {
  const { releaseTarget } = await import('./target.mjs');
  assert.equal(releaseTarget('develop').profile, 'staging');
  assert.equal(releaseTarget('main').apiUrl, 'https://api.sawaa.sa/api/v1');
  assert.throws(() => releaseTarget('feature/example'), /branch/);
});

test('CI build numbers reject malformed and overflowing Apple numbers', () => {
  const { resolveIosBuildNumber } = require('../../apps/mobile/constants/api-url-validation.js');
  for (const value of ['0', '-1', '10000', 'x', '2.3', '01']) {
    assert.throws(() => resolveIosBuildNumber(value));
  }
  assert.equal(resolveIosBuildNumber('36'), '36');
  assert.equal(resolveIosBuildNumber(undefined), undefined);
});
