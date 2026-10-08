import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './verify.mjs';
const f = fixture();
assert.equal(process.env.BACKEND_URL, 'http://127.0.0.1:55200');
const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { ConfigService } = require('@nestjs/config');
const { MoyasarCredentialsService } = require('../../apps/backend/dist/src/infrastructure/payments/moyasar-credentials.service.js');
const { DEFAULT_ORG_ID } = require('../../apps/backend/dist/src/common/constants.js');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const receipt = JSON.parse(readFileSync(resolve(process.env.E2E_LOCAL_RUN_DIR, 'webhook-receipt.json'), 'utf8'));
  const payment = await db.payment.findFirstOrThrow({ where: { status: 'COMPLETED', invoice: { clientId: f.clients.payment.id } }, include: { invoice: true } });
  assert.ok(receipt.deliveries.some(d => d.paymentId === payment.gatewayRef && d.eventType === 'payment_paid' && d.httpStatus === 200), 'A real registered webhook delivery must precede local replay');
  const config = await db.organizationPaymentConfig.findFirstOrThrow();
  assert.equal(config.isLive, false);
  const { webhookSecret } = new MoyasarCredentialsService(new ConfigService(process.env)).decrypt(config.webhookSecretEnc, DEFAULT_ORG_ID);
  const raw = JSON.stringify({ id: randomUUID(), type: 'payment_paid', data: {
    id: payment.gatewayRef, status: 'paid', amount: Number(payment.amount), currency: 'SAR', metadata: { invoiceId: payment.invoiceId },
  } });
  const before = await db.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, include: { payments: true } });
  const eventsBefore = await db.webhookEvent.count();
  async function post(signature) {
    const response = await fetch(`${process.env.BACKEND_URL}/api/v1/public/payments/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Moyasar-Signature': signature }, body: raw,
    });
    assert.equal(response.status, 200); return response.json();
  }
  const invalid = await post('0'.repeat(64));
  assert.equal(invalid.skipped, true);
  assert.equal(invalid.reason, 'invalid_signature');
  assert.equal(await db.webhookEvent.count(), eventsBefore);
  const duplicate = await post(createHmac('sha256', webhookSecret).update(raw).digest('hex'));
  assert.equal(duplicate.skipped, true); assert.equal(duplicate.reason, 'duplicate');
  assert.equal(await db.webhookEvent.count(), eventsBefore);
  assert.deepEqual(await db.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, include: { payments: true } }), before);
  writeFileSync(resolve(process.env.E2E_LOCAL_RUN_DIR, 'webhook-replay-receipt.json'), JSON.stringify({
    paymentId: payment.gatewayRef, invalidSignatureSkipped: true, duplicateSkipped: true, invoiceAndPaymentsUnchanged: true,
  }, null, 2));
  console.log('PASS: real webhook preceded replay; invalid signature and duplicate preserved invoice/payment state');
} finally { await db.$disconnect(); }
