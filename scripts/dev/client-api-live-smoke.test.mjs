import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkClientApi } from './client-api-live-smoke.mjs';

const expected = new Map([
  ['/health/live', 200], ['/client/profile', 401], ['/client/bookings', 401],
  ['/mobile/client/profile', 401], ['/public/me', 401],
  ['/public/payments/methods', 200],
]);
function fixtureFetch({ statusOverride, noDeprecation = false } = {}) {
  return async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    const cookie = options.headers?.Cookie;
    const status = statusOverride?.[path] ?? (options.method === 'POST' ? (cookie ? 403 : 401) : expected.get(path));
    const headers = new Headers();
    if (!noDeprecation && ['/mobile/client/profile', '/public/me'].includes(path)) headers.set('Deprecation', 'true');
    return new Response(JSON.stringify(cookie ? { code: 'CSRF_INVALID' } : {}), { status, headers });
  };
}
test('rejects an authenticated client route that responds anonymously', async () => {
  await assert.rejects(checkClientApi('http://127.0.0.1:55200/api/v1', fixtureFetch({ statusOverride: { '/client/profile': 200 } })), /client\/profile/);
});
test('rejects aliases without deprecation headers', async () => {
  await assert.rejects(checkClientApi('http://127.0.0.1:55200/api/v1', fixtureFetch({ noDeprecation: true })), /Deprecation/);
});
test('rejects shared or external services before making any request', async () => {
  let requested = false;
  await assert.rejects(checkClientApi('https://api.sawaa.sa/api/v1', async () => { requested = true; }), /isolated/);
  assert.equal(requested, false);
});
test('accepts protected routes, aliases and cookie versus bearer CSRF behavior', async () => {
  assert.equal(await checkClientApi('http://127.0.0.1:55200/api/v1', fixtureFetch()), 9);
});
