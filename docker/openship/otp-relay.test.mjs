import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import test from 'node:test';

import * as module from './otp-relay.mjs';

{
  const key = 'synthetic-relay-test-key';
  const phone = '+966500000101';
  const payload = { method: 'sms', phone, otp: '1234', template_id: 1 };
  async function fixture(t, fetchImpl = async () => new Response(JSON.stringify({ success: true }), { status: 200 })) {
    const calls = [];
    const server = module.createOtpRelay({ apiKey: key, allowedPhones: [phone], fetchImpl: async (...args) => {
      calls.push(args);
      return fetchImpl(...args);
    } });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => { server.closeAllConnections(); server.close(); });
    const root = `http://127.0.0.1:${server.address().port}`;
    const send = (body = payload, headers = {}, path = '/api/v2/send-otp') => fetch(root + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Authorization': key, ...headers }, body: JSON.stringify(body),
    });
    return { calls, root, send };
  }

  test('allowed SMS is forwarded to the fixed HTTPS provider once', async (t) => {
    const { send, calls } = await fixture(t);
    assert.equal((await send()).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'https://api.authentica.sa/api/v2/send-otp');
    assert.deepEqual(JSON.parse(calls[0][1].body), payload);
    assert.equal(calls[0][1].headers['X-Authorization'], key);
    assert.equal(calls[0][1].redirect, 'error');
    assert.equal((await send()).status, 429);
    assert.equal(calls.length, 1, 'A repeated request must not send a second SMS');
  });

  test('other recipients, channels, extra fields and routes never reach provider', async (t) => {
    const { send, calls } = await fixture(t);
    for (const body of [
      { ...payload, phone: '+966500000102' },
      { ...payload, phone: ['+966500000101', '+966500000102'] },
      { ...payload, method: 'email', email: 'somebody@example.invalid' },
      { ...payload, email: 'somebody@example.invalid' },
      { ...payload, otp: 'not-a-code' },
    ]) assert.ok((await send(body)).status >= 400);
    assert.equal((await send(payload, {}, '/api/v2/send-sms')).status, 404);
    assert.equal((await send(payload, {}, '/api/v2/send-otp?phone=other')).status, 404);
    assert.equal(calls.length, 0);
  });

  test('missing or wrong key cannot send or query balance', async (t) => {
    const { send, calls, root } = await fixture(t);
    assert.equal((await send(payload, { 'X-Authorization': '' })).status, 401);
    assert.equal((await send(payload, { 'X-Authorization': 'wrong' })).status, 401);
    assert.equal((await fetch(root + '/api/v2/balance')).status, 401);
    assert.equal(calls.length, 0);
  });

  test('authenticated balance and local health do not send SMS', async (t) => {
    const { root, calls } = await fixture(t, async () => new Response(JSON.stringify({ data: { balance: '179.00' } }), { status: 200 }));
    assert.equal((await fetch(root + '/health')).status, 200);
    assert.equal(calls.length, 0);
    const response = await fetch(root + '/api/v2/balance', { headers: { 'X-Authorization': key } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: { balance: '179.00' } });
    assert.equal(calls[0][0], 'https://api.authentica.sa/api/v2/balance');
    assert.equal(calls[0][1].method, 'GET');
  });

  test('missing, nonnumeric and explicitly rejected balances fail closed', async (t) => {
    for (const body of [{ success: true }, { data: { balance: '' } }, { data: { balance: 'NaN' } }, { success: false, data: { balance: 100 } }]) {
      const { root } = await fixture(t, async () => new Response(JSON.stringify(body), { status: 200 }));
      const response = await fetch(root + '/api/v2/balance', { headers: { 'X-Authorization': key } });
      assert.equal(response.status, 502);
    }
  });

  test('provider rejection and failed success flags cannot look successful', async (t) => {
    for (const response of [
      new Response(JSON.stringify({ success: false }), { status: 200 }),
      new Response('secret upstream error', { status: 401 }),
      new Response('not JSON', { status: 200 }),
    ]) {
      const { send } = await fixture(t, async () => response);
      const result = await send();
      assert.equal(result.status, 502);
      assert.ok(!(await result.text()).includes('secret upstream error'));
    }
  });

  test('malformed JSON and oversized bodies fail before provider access', async (t) => {
    const { root, calls } = await fixture(t);
    for (const body of ['{', 'x'.repeat(5000)]) {
      const r = await fetch(root + '/api/v2/send-otp', { method: 'POST', headers: { 'X-Authorization': key, 'Content-Type': 'application/json' }, body });
      assert.ok(r.status === 400 || r.status === 413);
    }
    assert.equal(calls.length, 0);
  });

  test('relay refuses startup without a nonempty valid allowlist and key', () => {
    for (const opts of [{ apiKey: '', allowedPhones: [phone] }, { apiKey: key, allowedPhones: [] }, { apiKey: key, allowedPhones: ['*'] }]) {
      assert.throws(() => module.createOtpRelay(opts));
    }
  });
}
