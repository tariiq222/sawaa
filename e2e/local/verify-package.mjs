import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './verify.mjs';
const f = fixture();
const phase = process.argv[2];
assert.ok(['reserved', 'cancelled'].includes(phase));
const input = JSON.parse(readFileSync(resolve(process.env.E2E_LOCAL_RUN_DIR, 'package-fixture.json'), 'utf8'));
const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const purchases = await db.packagePurchase.findMany({ where: { packageId: input.packageId, clientId: f.clients.payment.id }, include: { credits: { include: { usages: true } } } });
  assert.equal(purchases.length, 1);
  const purchase = purchases[0];
  assert.equal(purchase.status, 'ACTIVE'); assert.equal(Number(purchase.amountPaid), 60000);
  assert.equal(purchase.credits.length, 2);
  assert.equal(purchase.credits.reduce((n,c) => n+c.totalQuantity, 0), 2);
  assert.equal(purchase.credits.reduce((n,c) => n+c.usedQuantity, 0), 0);
  assert.equal(purchase.credits.reduce((n,c) => n+c.reservedQuantity, 0), phase === 'reserved' ? 1 : 0);
  const invoices = await db.invoice.findMany({ where: { packagePurchaseId: purchase.id }, include: { payments: true } });
  assert.equal(invoices.length, 1); assert.equal(invoices[0].status, 'PAID'); assert.equal(Number(invoices[0].total), 60000);
  assert.equal(invoices[0].payments.length, 1); assert.equal(invoices[0].payments[0].status, 'COMPLETED');
  assert.equal(invoices[0].currency, 'SAR');
  assert.equal(invoices[0].payments[0].currency, 'SAR');
  assert.equal(Number(invoices[0].payments[0].amount), input.priceHalalas);
  const usages = purchase.credits.flatMap(c => c.usages);
  assert.equal(usages.length, 1); assert.equal(usages[0].status, phase === 'reserved' ? 'RESERVED' : 'RETURNED');
  const booking = await db.booking.findUniqueOrThrow({ where: { id: usages[0].bookingId } });
  assert.equal(booking.status, phase === 'reserved' ? 'CONFIRMED' : 'CANCELLED');
  assert.equal(booking.serviceId, f.serviceId); assert.equal(booking.employeeId, f.employeeId);
  assert.equal(booking.scheduledAt.toISOString(), new Date(f.appointments.mobile).toISOString());
  assert.equal(await db.invoice.count({ where: { bookingId: booking.id } }), 0);
  const receipt = { phase, purchaseId: purchase.id, status: purchase.status, amountPaid: Number(purchase.amountPaid),
    invoiceId: invoices[0].id, paymentId: invoices[0].payments[0].id, bookingId: booking.id, bookingStatus: booking.status,
    scheduledAt: booking.scheduledAt, creditCount: 2, used: 0, reserved: phase === 'reserved' ? 1 : 0, usageStatus: usages[0].status };
  writeFileSync(resolve(process.env.E2E_LOCAL_RUN_DIR, `package-${phase}-receipt.json`), JSON.stringify(receipt, null, 2));
  console.log(`PASS: package ${phase}; one paid invoice/payment, two credits, exact booking and ledger state`);
} finally { await db.$disconnect(); }
