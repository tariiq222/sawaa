import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertIsolatedDatabase } from './safety.mjs';

const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
export function fixture() {
  if (!process.env.E2E_LOCAL_FIXTURE) throw new Error('Run via e2e/local/with-env.mjs');
  assertIsolatedDatabase(process.env.DATABASE_URL);
  return JSON.parse(readFileSync(process.env.E2E_LOCAL_FIXTURE, 'utf8'));
}
export async function verifyBooking(kind, status = 'CONFIRMED') {
  const f = fixture();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const bookings = await prisma.booking.findMany({ where: { clientId: f.clients[kind].id } });
    assert.equal(bookings.length, 1, 'Exactly one booking must exist for this synthetic client');
    const b = bookings[0];
    assert.equal(b.serviceId, f.serviceId);
    assert.equal(b.employeeId, f.employeeId);
    assert.equal(b.branchId, f.branchId);
    assert.equal(b.durationMins, 60);
    assert.equal(b.deliveryType, 'IN_PERSON');
    const selectedStart = new Date(f.appointments[kind]);
    assert.equal(b.scheduledAt.toISOString(), selectedStart.toISOString(), 'Persisted start must match the exact selected slot');
    assert.equal(b.endsAt.toISOString(), new Date(selectedStart.getTime() + 60 * 60_000).toISOString());
    assert.equal(Number(b.price), f.priceHalalas);
    assert.equal(b.currency, 'SAR');
    assert.equal(b.status, status);
    assert.equal(b.payAtClinic, kind !== 'payment');
    const invoices = await prisma.invoice.findMany({ where: { bookingId: b.id }, include: { payments: true } });
    if (kind !== 'payment') {
      assert.equal(b.expiresAt, null);
      assert.equal(invoices.length, 0, 'Pay-at-clinic creation must not invent a paid invoice');
    } else {
      assert.equal(invoices.length, 1);
      assert.equal(Number(invoices[0].total), f.priceHalalas);
      assert.equal(Number(invoices[0].vatAmt), 0);
      assert.equal(invoices[0].currency, 'SAR');
      assert.equal(invoices[0].status, status === 'CONFIRMED' ? 'PAID' : 'DRAFT');
      if (status === 'CONFIRMED') {
        const completed = invoices[0].payments.filter(p => p.status === 'COMPLETED');
        assert.equal(completed.length, 1, 'Repeated reconciliation must not duplicate completed payments');
        assert.equal(Number(completed[0].amount), f.priceHalalas);
        assert.equal(completed[0].currency, 'SAR');
      }
    }
    const receipt = { bookingId: b.id, bookingNumber: b.bookingNumber, clientId: b.clientId, serviceId: b.serviceId,
      employeeId: b.employeeId, priceHalalas: Number(b.price), currency: b.currency,
      scheduledAt: b.scheduledAt.toISOString(), endsAt: b.endsAt.toISOString(), deliveryType: b.deliveryType,
      status: b.status, payAtClinic: b.payAtClinic, invoices: invoices.map(i => ({ id: i.id, status: i.status, totalHalalas: Number(i.total) })) };
    writeFileSync(resolve(process.env.E2E_LOCAL_RUN_DIR, `${kind}-receipt.json`), JSON.stringify(receipt, null, 2));
    return receipt;
  } finally { await prisma.$disconnect(); }
}
