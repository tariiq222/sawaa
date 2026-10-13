import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { assertIsolatedDatabase } from '../../e2e/local/safety.mjs';

/** Read-only HTTP checks; no server boot or checkout credentials are inherited. */
export async function checkClientApi(base, request = fetch) {
  const url = new URL(base);
  assert.ok(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '55200'
    && url.pathname === '/api/v1' && !url.username && !url.password && !url.search && !url.hash,
  'Use the isolated local backend on 127.0.0.1:55200');
  let checked = 0;
  async function check(path, status, options = {}) {
    const response = await request(`${base}${path}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, status, `${options.method ?? 'GET'} ${path}: unexpected HTTP status`);
    checked++;
    return response;
  }
  await check('/health/live', 200);
  for (const path of ['/client/profile', '/client/bookings']) {
    const response = await check(path, 401);
    assert.equal(response.headers.has('Deprecation'), false, `${path}: canonical route must not be deprecated`);
  }
  for (const path of ['/mobile/client/profile', '/public/me']) {
    const response = await check(path, 401);
    assert.equal(response.headers.get('Deprecation'), 'true', `${path}: missing Deprecation header`);
  }
  await check('/public/payments/methods', 200);
  for (const path of ['/client/bookings', '/mobile/client/bookings']) {
    const response = await check(path, 403, { method: 'POST', headers: {
      'Content-Type': 'application/json', Cookie: 'client_access_token=invalid',
    }, body: '{}' });
    assert.equal((await response.json()).code, 'CSRF_INVALID', `${path}: cookie mutation must enforce CSRF`);
  }
  await check('/client/bookings', 401, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer invalid',
  }, body: '{}' });
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assert.ok(process.env.E2E_LOCAL_RUN_DIR && process.env.E2E_LOCAL_FIXTURE, 'Run via e2e/local/with-env.mjs');
    assertIsolatedDatabase(process.env.DATABASE_URL);
    const count = await checkClientApi('http://127.0.0.1:55200/api/v1');
    console.log(`PASS: ${count} isolated client API HTTP checks`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
