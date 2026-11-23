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
    const online = ['payment', 'apple', 'hosted'].includes(kind);
    assert.equal(b.payAtClinic, !online);
    const invoices = await prisma.invoice.findMany({ where: { bookingId: b.id }, include: { payments: true } });
    if (!online) {
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

/**
 * Prove private reservation identity only through the isolated local database.
 * @param {{ paymentId: string; invoiceId: string; bookingId: string; status?: 'PENDING' | 'COMPLETED' }} expected
 */
export async function verifyNativePayment({ paymentId, invoiceId, bookingId, status }) {
  assert.ok([paymentId, invoiceId, bookingId].every(id => typeof id === 'string' && id.trim().length > 0),
    'Native reservation identifiers are required');
  const f = fixture();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, bookingId, clientId: f.clients.payment.id },
      select: { id: true, bookingId: true, clientId: true,
        payments: { select: { id: true, gatewayRef: true, status: true, amount: true, currency: true } } },
    });
    assert.ok(invoice, 'Native reservation must belong to the isolated payment client and booking');
    assert.equal(invoice.clientId, f.clients.payment.id);
    assert.equal(invoice.payments.length, 1, 'Native checkout must have exactly one reserved payment');
    const payment = invoice.payments[0];
    assert.equal(payment.id, paymentId);
    assert.equal(payment.gatewayRef, paymentId, 'Existing attempt must be a native reservation');
    assert.equal(Number(payment.amount), f.priceHalalas);
    assert.equal(payment.currency, 'SAR');
    if (status) assert.equal(payment.status, status);
    return { paymentId: payment.id, invoiceId: invoice.id, bookingId: invoice.bookingId, status: payment.status };
  } finally { await prisma.$disconnect(); }
}

/**
 * Prove a website hosted-checkout attempt only through the isolated local database.
 * The hosted gateway reference is checked but never returned or written anywhere.
 * @param {{ bookingId: string; invoiceId: string; status?: 'PENDING' | 'COMPLETED' }} expected
 */
export async function verifyHostedPayment({ bookingId, invoiceId, status }) {
  assert.ok([bookingId, invoiceId].every(id => typeof id === 'string' && id.trim().length > 0),
    'Hosted checkout identifiers are required');
  const f = fixture();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, bookingId, clientId: f.clients.hosted.id },
      select: { id: true, bookingId: true, clientId: true, status: true,
        payments: { select: { id: true, gatewayRef: true, status: true, amount: true, currency: true } } },
    });
    assert.ok(invoice, 'Hosted checkout must belong to the isolated hosted client and booking');
    assert.equal(invoice.clientId, f.clients.hosted.id);
    assert.equal(invoice.bookingId, bookingId);
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId: f.clients.hosted.id }, select: { status: true },
    });
    assert.ok(booking, 'Hosted checkout booking must belong to the isolated hosted client');
    assert.equal(invoice.payments.length, 1, 'Hosted checkout must have exactly one payment attempt');
    const payment = invoice.payments[0];
    assert.equal(Number(payment.amount), f.priceHalalas);
    assert.equal(payment.currency, 'SAR');
    assert.ok(typeof payment.gatewayRef === 'string' && payment.gatewayRef.trim().length > 0,
      'Hosted checkout must store a gateway reference');
    assert.notEqual(payment.gatewayRef, payment.id, 'Hosted attempt must not be a native reservation');
    if (status) assert.equal(payment.status, status);
    return { bookingId: invoice.bookingId, invoiceId: invoice.id, paymentId: payment.id,
      paymentStatus: payment.status, invoiceStatus: invoice.status, bookingStatus: booking.status,
      amountHalalas: Number(payment.amount), currency: payment.currency };
  } finally { await prisma.$disconnect(); }
}
