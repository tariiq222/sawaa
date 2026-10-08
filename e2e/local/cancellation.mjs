import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './verify.mjs';
const f = fixture();
assert.equal(process.env.BACKEND_URL, 'http://127.0.0.1:55200');
const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function api(path, method = 'GET', body, token) {
  const response = await fetch(`${process.env.BACKEND_URL}/api/v1${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000),
  });
  assert.ok(response.ok, `Cancellation HTTP ${response.status} at ${path}`); return response.json();
}
try {
  assert.equal(await db.booking.count({ where: { clientId: f.clients.web.id } }), 0, 'Fresh reserved web client required');
  await db.bookingSettings.create({ data: { branchId: f.branchId, payAtClinicEnabled: true,
    clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_START', clientCancelBeforeHours: 0,
    freeCancelBeforeHours: 24, freeCancelRefundType: 'FULL', lateCancelRefundPercent: 0,
    autoRefundOnCancel: false, requireCancelApproval: true,
  } });
  const session = await api('/mobile/auth/password-login', 'POST', { email: f.clients.web.email, password: process.env.E2E_USER_CLIENT_PASSWORD });
  const token = session.tokens.accessToken;
  const booking = await api('/mobile/client/bookings', 'POST', {
    branchId: f.branchId, employeeId: f.employeeId, serviceId: f.serviceId,
    durationOptionId: f.optionId, deliveryType: 'IN_PERSON', scheduledAt: f.appointments.web, payAtClinic: true,
  }, token);
  assert.equal(booking.status, 'CONFIRMED');
  const path = `/mobile/client/bookings/${booking.id}`;
  const quote = await api(`${path}/cancellation-preview`, 'GET', undefined, token);
  assert.equal(quote.canCancel, true); assert.equal(quote.policyEnabled, true);
  const body = { acceptedRefundTerms: true, quoteToken: quote.quoteToken, sourceActionId: randomUUID(), reason: 'CLIENT_REQUESTED' };
  const cancelled = await api(`${path}/cancel`, 'PATCH', body, token);
  assert.equal(cancelled.status, 'CANCELLED');
  await api(`${path}/cancel`, 'PATCH', body, token);
  const persisted = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
  assert.equal(persisted.status, 'CANCELLED');
  assert.equal(await db.invoice.count({ where: { bookingId: booking.id } }), 0);
  assert.equal(await db.bookingStatusLog.count({ where: { bookingId: booking.id, toStatus: 'CANCELLED' } }), 1);
  const events = await db.outboxEvent.count({ where: { aggregateId: booking.id, eventType: 'bookings.booking.cancelled' } });
  assert.equal(events, 1);
  writeFileSync(resolve(process.env.E2E_LOCAL_RUN_DIR, 'cancellation-receipt.json'), JSON.stringify({
    bookingId: booking.id, status: persisted.status, duplicateRequestSafe: true, cancellationEvents: events,
    invoices: 0, providerRefund: 'not applicable: pay at center', transport: 'real local mobile HTTP API, real database and outbox',
  }, null, 2));
  console.log('PASS: local booking cancelled once; replay created no extra event, status log or invoice');
} finally { await db.$disconnect(); }
