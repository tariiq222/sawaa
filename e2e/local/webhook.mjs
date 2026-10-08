import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './verify.mjs';

const f = fixture();
const runDir = process.env.E2E_LOCAL_RUN_DIR;
const saved = JSON.parse(readFileSync(resolve(runDir, 'environment.json'), 'utf8'));
assert.equal(saved.DATABASE_URL, process.env.DATABASE_URL);
assert.equal(process.env.BACKEND_URL, 'http://127.0.0.1:55200');
const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { ConfigService } = require('@nestjs/config');
const { MoyasarCredentialsService } = require('../../apps/backend/dist/src/infrastructure/payments/moyasar-credentials.service.js');
const { DEFAULT_ORG_ID } = require('../../apps/backend/dist/src/common/constants.js');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const config = await db.organizationPaymentConfig.findFirstOrThrow();
assert.ok(config.isLive === false && config.publishableKey.startsWith('pk_test_'));
const crypt = new MoyasarCredentialsService(new ConfigService(process.env));
const { secretKey } = crypt.decrypt(config.secretKeyEnc, DEFAULT_ORG_ID);
const { webhookSecret } = crypt.decrypt(config.webhookSecretEnc, DEFAULT_ORG_ID);
assert.ok(/^sk_test_[A-Za-z0-9]+$/.test(secretKey) && typeof webhookSecret === 'string');
const auth = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
const path = `/moyasar/${randomBytes(24).toString('hex')}`;
const receipt = { registeredId: null, deleted: false, deliveries: [] };
function save() { writeFileSync(resolve(runDir, 'webhook-receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 }); }
function equal(a, b) { const x = Buffer.from(a ?? ''); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'POST' || req.url !== path) { res.writeHead(404).end(); return; }
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 262144) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    const body = JSON.parse(raw);
    if (typeof body.secret_token !== 'string' || !equal(body.secret_token, webhookSecret)) { res.writeHead(401).end(); return; }
    const paymentId = body.data?.id;
    if (typeof paymentId !== 'string') { res.writeHead(400).end(); return; }
    const payment = await db.payment.findFirst({ where: { gatewayRef: paymentId }, include: { invoice: true } });
    // Sandbox webhook subscriptions cover the account. Discard unrelated events
    // without persisting bodies; only this fixture's clients may reach our API.
    if (!payment || !Object.values(f.clients).some(c => c.id === payment.invoice.clientId)) { res.writeHead(200).end(); return; }
    const response = await fetch(`${process.env.BACKEND_URL}/api/v1/public/payments/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw,
      signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json();
    receipt.deliveries.push({ paymentId, eventType: body.type, receivedAt: new Date().toISOString(),
      httpStatus: response.status, skipped: result.skipped === true, reason: result.reason ?? null });
    save(); res.writeHead(response.status).end();
  } catch { res.writeHead(503).end(); }
});
let tunnel;
let webhookId;
let stop;
const stopped = new Promise(ok => { stop = ok; });
process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(55207, '127.0.0.1', ok); });
  tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://127.0.0.1:55207', '--no-autoupdate'], {
    env: Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k => process.env[k]).map(k => [k,process.env[k]])),
    stdio: ['ignore','pipe','pipe'],
  });
  const origin = await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('Temporary webhook tunnel timed out')), 45_000);
    const chunk = data => {
      const match = data.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) { clearTimeout(timer); ok(match[0]); }
    };
    tunnel.stdout.on('data', chunk); tunnel.stderr.on('data', chunk);
    tunnel.once('error', err => { clearTimeout(timer); fail(err); });
    tunnel.once('exit', () => { clearTimeout(timer); fail(new Error('Webhook tunnel exited')); stop(); });
  });
  // Keep the unique URL privately for recovery if registration has an ambiguous outcome.
  writeFileSync(resolve(runDir, 'webhook-registration.private.json'), JSON.stringify({ url: origin + path }), { mode: 0o600 });
  const response = await fetch('https://api.moyasar.com/v1/webhooks', {
    method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ http_method: 'post', url: origin + path, shared_secret: webhookSecret,
      events: ['payment_paid', 'payment_failed'] }), signal: AbortSignal.timeout(20_000),
  });
  assert.ok(response.ok, `Sandbox webhook registration HTTP ${response.status}`);
  const created = await response.json();
  assert.match(created.id, /^[0-9a-f-]{36}$/i);
  webhookId = created.id; receipt.registeredId = webhookId; save();
  console.log('READY: dedicated Sandbox webhook registered; only fixture payments are forwarded');
  await stopped;
} finally {
  try {
  if (webhookId) {
    const response = await fetch(`https://api.moyasar.com/v1/webhooks/${webhookId}`, {
      method: 'DELETE', headers: { Authorization: auth }, signal: AbortSignal.timeout(20_000),
    });
    receipt.deleted = response.ok || response.status === 404; save();
    if (!receipt.deleted) {
      process.exitCode = 1;
      console.error(`Sandbox webhook cleanup requires attention: HTTP ${response.status}`);
    }
  }
  } finally {
    tunnel?.kill('SIGTERM'); server.closeAllConnections(); server.close(); await db.$disconnect();
  }
}
